import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

function run(cmd: string, args: string[], onLine?: (l: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      if (onLine) s.split("\n").forEach(onLine);
    });
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`)));
  });
}

export async function isValidMedia(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    await run("ffprobe", ["-v", "error", "-show_format", p]);
    return true;
  } catch { return false; }
}

// Idempotent + atomic: skip if output is valid, write to .tmp then rename.
async function atomic(outPath: string, produce: (tmp: string) => Promise<void>) {
  if (await isValidMedia(outPath)) return outPath;
  const tmp = outPath + ".tmp.mp4";
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.rm(tmp, { force: true });
  await produce(tmp);
  await fs.rename(tmp, outPath);
  return outPath;
}

export async function probe(src: string) {
  const json = await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", src]);
  const d = JSON.parse(json);
  const v = d.streams.find((s: any) => s.codec_type === "video");
  const [n, den] = v.r_frame_rate.split("/").map(Number);
  return {
    duration: parseFloat(d.format.duration),
    fps: n / den,
    width: v.width, height: v.height,
    vcodec: v.codec_name as string,
  };
}

export const makeProxy = (src: string, out: string) =>
  atomic(out, (tmp) => run("ffmpeg", [
    "-y", "-i", src, "-vf", "scale=-2:480",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-g", "30",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", tmp]).then(() => {}));

export async function extractAudio(src: string, out: string) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out]);
  return out;
}

// Re-encode (not stream copy) so cuts are frame-accurate and all segments
// share identical parameters, which makes the final concat -c copy safe.
export const renderSegment = (
  src: string, inT: number, outT: number, out: string,
  onProgress: (pct: number) => void, threads = 2,
) => {
  const dur = outT - inT;
  return atomic(out, (tmp) => run("ffmpeg", [
    "-y", "-ss", inT.toFixed(3), "-i", src, "-t", dur.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-ac", "2",
    "-af", `afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, dur - 0.015).toFixed(3)}:d=0.015`,
    "-threads", String(threads),
    "-f", "mp4", "-progress", "pipe:1", "-nostats", tmp,
  ], (line) => {
    const m = line.match(/^out_time_us=(\d+)/);
    if (m) onProgress(Math.min(100, (Number(m[1]) / 1e6 / dur) * 100));
  }).then(() => {}));
};

export async function concat(parts: string[], out: string) {
  const list = out + ".txt";
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  await atomic(out, (tmp) =>
    run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-f", "mp4", tmp]).then(() => {}));
  return out;
}
