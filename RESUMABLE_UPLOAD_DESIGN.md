# Resumable Upload (Phase 2C)

Addresses: "huge files, flaky uploads" and "instant-feeling uploads" (Backend JD), and "improve long-running media workflows: uploads, ... progress, and recovery".

Scope statement for the README: a resumable, integrity-checked upload path built on the tus protocol model, tested on multi-GB files with simulated network failure. Single server, local disk (optionally MinIO).

---

## 1. The question the project answers

> Can a multi-GB upload survive dropped connections, tab reloads and corrupted chunks, with flat server memory and minimal re-sent data, and how do we prove it?

---

## 2. Decision: implement the core yourself, or use a library?

| Option | Pros | Cons |
|---|---|---|
| Use `@tus/server` | Fast, protocol-correct | Less to show; you can only claim integration |
| **Implement the core protocol yourself on your Storage interface** | You can explain offsets, concurrency, partial writes, integrity | More work; must be tested against a real tus client |

Recommendation: implement the core yourself, and **test it against `tus-js-client`** so protocol compatibility is proven. If time runs out, switch to `@tus/server` and describe it honestly as an integration.

---

## 3. Protocol (tus core + extensions you will implement)

Every request carries `Tus-Resumable: 1.0.0`.

```
OPTIONS /uploads
  -> 204, Tus-Version: 1.0.0, Tus-Extension: creation,checksum,expiration,termination, Tus-Max-Size

POST /uploads        (creation)
  Upload-Length: 3221225472
  Upload-Metadata: filename <base64>, filetype <base64>
  -> 201, Location: /uploads/<id>, Upload-Offset: 0 (implicit)

HEAD /uploads/<id>
  -> 200, Upload-Offset: <bytes received>, Upload-Length: <total>, Cache-Control: no-store

PATCH /uploads/<id>
  Content-Type: application/offset+octet-stream
  Upload-Offset: <must equal server offset>
  Upload-Checksum: sha256 <base64 digest>     (checksum extension; optional per request)
  body: chunk bytes
  -> 204, Upload-Offset: <new offset>
  -> 409 if Upload-Offset != server offset
  -> 460 if checksum mismatch (tus-defined status for checksum failure)

DELETE /uploads/<id>  (termination)
  -> 204
```

Verify the exact header and status details against the tus spec while implementing. Do not rely on memory for edge cases.

---

## 4. Data model

```sql
CREATE TABLE uploads (
  id          uuid PRIMARY KEY,         -- unguessable (UUIDv4)
  size        bigint NOT NULL,          -- declared Upload-Length
  "offset"    bigint NOT NULL DEFAULT 0,
  status      text NOT NULL,            -- CREATED | UPLOADING | COMPLETE | EXPIRED | TERMINATED
  storage_key text NOT NULL,            -- derived from id, never from filename
  filename    text,                     -- display only
  mime        text,
  asset_id    uuid,                     -- set on completion
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
```

Security rules:
- Storage paths come from the upload id only. The client filename is metadata, never a path.
- Enforce a max size (`Tus-Max-Size`) and check free disk space (`statfs`) at creation.
- Ids are random and unguessable.

---

## 5. Server design

### Storage interface
```ts
interface Storage {
  create(key: string, size: number): Promise<void>;
  append(key: string, offset: number, stream: Readable): Promise<number>; // returns bytes written
  stat(key: string): Promise<{ size: number } | null>;
  open(key: string): Readable;
  move(from: string, to: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```
Implementations: `LocalStorage` (default) and optionally `MinioStorage` (S3 multipart).

### PATCH handling (the interesting part)
1. Load the upload row. If not `CREATED` or `UPLOADING`, reject.
2. **Take a per-upload lock** (Postgres advisory lock on a hash of the id, or a Redis lock) so two concurrent PATCHes cannot interleave.
3. Compare `Upload-Offset` with the **actual file size on disk** (the source of truth), not only the DB value. Mismatch -> `409`.
4. **Stream** the request body into the file at that offset (write stream with append flag). Never buffer the whole chunk in memory.
5. If a checksum header was sent, hash the bytes as they stream. Compare at the end. On mismatch, **truncate back to the previous offset** and return the checksum-mismatch status.
6. **Partial chunks**: if the connection drops mid-PATCH, keep the bytes already written. Update the offset to the real file size when the stream closes or errors. The client's next `HEAD` returns this exact offset, so almost nothing is re-sent.
7. Update the DB offset and `updated_at`, and extend `expires_at`.
8. If `offset == size`: finalize.

### Finalize
- Verify file size equals declared size.
- Optionally compute a full-file SHA-256 by streaming (and compare against a client-provided final hash if given).
- Move the file into the asset directory, create the asset row, and enqueue the ingest job with `jobId = "ingest:" + uploadId` so a repeated finalize cannot enqueue twice.

### Expiry cleanup
A BullMQ repeatable job removes uploads where `status != COMPLETE` and `expires_at < now()`, deleting the partial file and marking the row `EXPIRED`.

### Backpressure and memory
Use Node streams with `pipeline`, so slow disks slow the socket instead of growing memory. This is what you will prove with the memory measurement.

---

## 6. Client design

Use `tus-js-client`:
```ts
const upload = new tus.Upload(file, {
  endpoint: "/uploads",
  chunkSize: 8 * 1024 * 1024,
  retryDelays: [0, 1000, 3000, 5000, 10000],
  metadata: { filename: file.name, filetype: file.type },
  onProgress, onSuccess, onError,
});
const previous = await upload.findPreviousUploads();   // resume after a tab reload
if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
upload.start();
```
UI shows: percent, speed, ETA, and distinct states for "uploading", "reconnecting" and "resuming".

Chunk size tradeoff: small chunks mean more requests and more overhead; large chunks mean more data lost on a drop (unless partial writes are kept, which this design does). Measure instead of guessing (section 8).

---

## 7. Optional: S3-compatible storage (MinIO)

- Map the upload to an S3 multipart upload. Each tus chunk becomes one or more parts.
- Constraints to respect: parts other than the last must be at least 5 MB, and a multipart upload is limited to 10,000 parts. Choose the chunk size accordingly.
- Only say "S3-compatible" in the README if you actually ran it against MinIO.

---

## 8. Test and measurement plan

| Test | How | What to record |
|---|---|---|
| Large file | 2-4 GB file | Total time, average throughput, peak API RSS |
| Network drop | toxiproxy (run in Docker) with a timeout toxic, or browser offline mode | Time to resume, bytes re-sent after the drop |
| Tab reload | Reload mid-upload | Resumes from the correct offset |
| Server restart | Restart the API container mid-upload | Resumes from disk state |
| Corrupt chunk | Flip bytes in one chunk through a proxy or a test client | Checksum rejects it; file ends correct after retry |
| Concurrent PATCH | Send two PATCHes at the same offset | One succeeds, one gets 409; file not corrupted |
| Latency | toxiproxy latency toxic (e.g. 100-200 ms) | Throughput vs chunk size (1, 4, 8, 16, 32 MB), plotted |
| Expiry | Create and abandon an upload | Cleanup job removes it |
| Final integrity | SHA-256 of source vs stored file | Identical |

Report numbers from your machine and note its specs. On an 8 GB laptop, test with a 2 GB file; use larger files only if disk and time allow.

### Expected finding to check, not a claim
Peak API memory should stay roughly flat regardless of file size. If it grows, find out why (buffered body, unconsumed stream, hashing in memory) and write about it.

---

## 9. Layout

```
apps/api/src/uploads/
  uploads.controller.ts    # OPTIONS/POST/HEAD/PATCH/DELETE
  uploads.service.ts       # lock, offset checks, finalize
  storage/                 # Storage interface, local, minio (optional)
  cleanup.processor.ts     # expiry job
apps/web/src/upload/       # tus client wrapper + UI
tests/upload/              # protocol, concurrency, corruption tests
bench/upload/              # large-file and chunk-size benchmarks, results/
```

---

## 10. Plan (about 1 day)

- First half: schema, Storage interface and local implementation, POST/HEAD/PATCH with offset checks, per-upload lock, streaming writes, finalize and ingest enqueue.
- Second half: checksum support, partial-chunk handling, expiry job, client wrapper and UI, then the test table and the chunk-size benchmark.

---

## 11. Definition of done

- [ ] Works with an unmodified `tus-js-client`
- [ ] Resumes after network drop, tab reload and server restart
- [ ] Checksum rejects a corrupted chunk
- [ ] Concurrent PATCH at the same offset is safe
- [ ] Peak API memory measured on a multi-GB upload
- [ ] Chunk-size vs throughput chart
- [ ] Final file hash verified against the source
- [ ] Limitations section

## 12. Limitations to state

- Single server and local disk; no multi-node coordination
- No auth in v1
- Not tested against every tus client
- No parallel chunk upload (tus uploads sequentially)
- Large-file numbers depend on the laptop's disk and network
