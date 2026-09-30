import { Worker } from "bullmq";
import IORedis from "ioredis";
import path from "node:path";
import { probe, makeProxy, extractAudio } from "./ffmpeg";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const MEDIA = process.env.MEDIA_DIR ?? "/media";

// job.data = { assetId, srcPath }
new Worker("ingest", async (job) => {
  const { assetId, srcPath } = job.data;
  const meta = await probe(srcPath);
  if (meta.vcodec !== "h264") throw new Error(`Unsupported codec ${meta.vcodec} (H.264 only in v1)`);

  const dir = path.join(MEDIA, "assets", assetId);
  const proxy = await makeProxy(srcPath, path.join(dir, "proxy.mp4"));
  const audio = await extractAudio(srcPath, path.join(dir, "audio.wav"));

  // TODO: persist meta + paths to Postgres, set status TRANSCRIBING,
  // then POST {ANALYSIS_URL}/transcribe { audioPath: audio }
  return { meta, proxy, audio };
}, { connection, concurrency: 1 });
