import http from "node:http";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";
import path from "node:path";
import { probe, makeProxy, extractAudio } from "./ffmpeg";
import type { AssetStatus } from "../../../packages/contracts";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const pub = new IORedis(process.env.REDIS_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MEDIA = process.env.MEDIA_DIR ?? "/media";
const ANALYSIS_URL = process.env.ANALYSIS_URL ?? "http://analysis:8000";

function postJson(urlStr: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(new Error(`Invalid JSON from analysis: ${raw.slice(0, 200)}`));
            }
          } else {
            reject(new Error(`Analysis failed (${res.statusCode}): ${raw.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

interface IngestJobData {
  assetId: string;
  srcPath: string;
}

async function updateStatus(assetId: string, status: AssetStatus, error?: string) {
  await pool.query(
    "UPDATE assets SET status = $1, updated_at = NOW() WHERE id = $2",
    [status, assetId]
  );
  await pub.publish("asset-events", JSON.stringify({ assetId, status, error }));
}

new Worker<IngestJobData>(
  "ingest",
  async (job: Job<IngestJobData>) => {
    const { assetId, srcPath } = job.data;
    const dir = path.join(MEDIA, "assets", assetId);

    try {
      // 1. Probing
      await updateStatus(assetId, "PROBING");
      const meta = await probe(srcPath);

      if (meta.vcodec !== "h264") {
        throw new Error(`Unsupported codec ${meta.vcodec} (TakePicker v1 requires H.264/MP4)`);
      }

      // Update basic metadata
      await pool.query(
        "UPDATE assets SET duration = $1, fps = $2, width = $3, height = $4, vcodec = $5, updated_at = NOW() WHERE id = $6",
        [meta.duration, meta.fps, meta.width, meta.height, meta.vcodec, assetId]
      );

      // 2. Proxy generation & Audio extraction
      await updateStatus(assetId, "PROXYING");
      const proxyPath = path.join(dir, "proxy.mp4");
      const audioPath = path.join(dir, "audio.wav");

      await Promise.all([
        makeProxy(srcPath, proxyPath),
        extractAudio(srcPath, audioPath),
      ]);

      // 3. Audio analysis (Whisper transcription + retake clustering + scoring)
      await updateStatus(assetId, "ANALYZING");
      const analysisData = (await postJson(`${ANALYSIS_URL}/analyze`, {
        assetId,
        audioPath,
        fps: meta.fps,
      })) as {
        words: any[];
        segments: any[];
        groups: any[];
        timeline: any;
      };

      // 4. Persist transcripts and segmentation to Postgres in a transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Insert transcripts
        await client.query(
          `INSERT INTO transcripts (asset_id, words) 
           VALUES ($1, $2) 
           ON CONFLICT (asset_id) DO UPDATE SET words = $2`,
          [assetId, JSON.stringify(analysisData.words)]
        );

        // Insert take_groups & segments
        for (const group of analysisData.groups) {
          const groupId = group.id;

          await client.query(
            `INSERT INTO take_groups (id, asset_id, idx, overridden) 
             VALUES ($1, $2, $3, false) 
             ON CONFLICT (id) DO NOTHING`,
            [groupId, assetId, group.idx]
          );

          let chosenSegmentUuid: string | null = null;

          for (const take of group.takes) {
            const segRes = await client.query(
              `INSERT INTO segments (asset_id, idx, start_time, end_time, text, features, score, group_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id`,
              [
                assetId,
                take.idx,
                take.start,
                take.end,
                take.text,
                JSON.stringify(take.features ?? {}),
                take.score ?? 0,
                groupId,
              ]
            );

            if (take.idx === group.chosenSegmentId) {
              chosenSegmentUuid = segRes.rows[0].id;
            }
          }

          if (chosenSegmentUuid) {
            await client.query(
              `UPDATE take_groups SET chosen_segment_id = $1 WHERE id = $2`,
              [chosenSegmentUuid, groupId]
            );
          }
        }

        await client.query("COMMIT");
      } catch (dbErr) {
        await client.query("ROLLBACK");
        throw dbErr;
      } finally {
        client.release();
      }

      // 5. Finished
      await updateStatus(assetId, "READY");

      return {
        assetId,
        meta,
        proxyPath,
        audioPath,
        segmentCount: analysisData.segments.length,
        groupCount: analysisData.groups.length,
      };
    } catch (err: any) {
      console.error(`[Ingest Worker] Job failed for asset ${assetId}:`, err);
      await updateStatus(assetId, "FAILED", err.message);
      throw err;
    }
  },
  { connection, concurrency: 1 }
);
