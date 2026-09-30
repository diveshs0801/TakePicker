import { Worker, FlowProducer, Job } from "bullmq";
import IORedis from "ioredis";
import path from "node:path";
import { renderSegment, concat } from "./ffmpeg";
import type { Timeline, RenderSegmentJob, MergeJob, ProgressEvent } from "../../../packages/contracts";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const pub = new IORedis(process.env.REDIS_URL!);
const MEDIA = process.env.MEDIA_DIR ?? "/media";
const THREADS = Number(process.env.FFMPEG_THREADS ?? 2);

// ---- Producer: call this from the API when a render is requested ----
export async function enqueueRender(renderId: string, timeline: Timeline, srcPath: string) {
  const flow = new FlowProducer({ connection });
  const dir = path.join(MEDIA, "renders", renderId);
  const opts = { attempts: 3, backoff: { type: "exponential" as const, delay: 2000 } };

  await flow.add({
    name: "merge",
    queueName: "merge",
    data: { renderId, assetId: timeline.assetId, outPath: path.join(dir, "final.mp4") } satisfies MergeJob,
    children: timeline.clips.map((c, idx) => ({
      name: "render-segment",
      queueName: "render-segment",
      opts,
      data: {
        renderId, assetId: timeline.assetId, idx,
        in: c.in, out: c.out, srcPath,
        outPath: path.join(dir, `seg_${String(idx).padStart(4, "0")}.mp4`),
      } satisfies RenderSegmentJob,
    })),
  });
}

// ---- Workers: one process per container, scale with --scale render-worker=N ----
new Worker<RenderSegmentJob>("render-segment", async (job: Job<RenderSegmentJob>) => {
  const d = job.data;
  let last = 0;
  await renderSegment(d.srcPath, d.in, d.out, d.outPath, (pct) => {
    if (pct - last < 5) return; // throttle events
    last = pct;
    const evt: ProgressEvent = { renderId: d.renderId, segmentIdx: d.idx, pct };
    pub.publish("render-progress", JSON.stringify(evt));
  }, THREADS);
  pub.publish("render-progress", JSON.stringify({ renderId: d.renderId, segmentIdx: d.idx, pct: 100 }));
  return { idx: d.idx, path: d.outPath };
}, { connection, concurrency: 1 });

new Worker<MergeJob>("merge", async (job: Job<MergeJob>) => {
  const children = Object.values(await job.getChildrenValues()) as { idx: number; path: string }[];
  children.sort((a, b) => a.idx - b.idx);
  await concat(children.map((c) => c.path), job.data.outPath);
  pub.publish("render-done", JSON.stringify({ renderId: job.data.renderId, path: job.data.outPath }));
  return job.data.outPath;
}, { connection });
