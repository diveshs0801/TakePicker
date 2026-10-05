-- PostgreSQL Schema for TakePicker

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Source video assets
CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  duration      FLOAT,
  fps           FLOAT,
  width         INT,
  height        INT,
  vcodec        TEXT,
  status        TEXT NOT NULL DEFAULT 'UPLOADED',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Async jobs tracker
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,  -- 'ingest' | 'analyze' | 'render'
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  progress      FLOAT DEFAULT 0,
  error         TEXT,
  attempts      INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Word-level transcripts from Whisper
CREATE TABLE IF NOT EXISTS transcripts (
  asset_id      UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  words         JSONB NOT NULL,  -- [{w: "hello", start: 0.12, end: 0.45, prob: 0.98}]
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Take groups (retake clusters)
CREATE TABLE IF NOT EXISTS take_groups (
  id                  TEXT PRIMARY KEY,
  asset_id            UUID REFERENCES assets(id) ON DELETE CASCADE,
  idx                 INT NOT NULL,
  chosen_segment_id   UUID,
  overridden          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Individual speech segments (takes)
CREATE TABLE IF NOT EXISTS segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE,
  idx           INT NOT NULL,
  start_time    FLOAT NOT NULL,
  end_time      FLOAT NOT NULL,
  text          TEXT NOT NULL,
  features      JSONB,         -- feature breakdown { wpm, fillers, pauses, audio_stability }
  score         FLOAT,
  group_id      TEXT REFERENCES take_groups(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key back to chosen segment
ALTER TABLE take_groups 
  DROP CONSTRAINT IF EXISTS fk_chosen_segment,
  ADD CONSTRAINT fk_chosen_segment 
  FOREIGN KEY (chosen_segment_id) REFERENCES segments(id) ON DELETE SET NULL;

-- 6. Render jobs (the clean cut)
CREATE TABLE IF NOT EXISTS renders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE,
  timeline      JSONB NOT NULL,  -- edit list with clips [{ in, out, groupId, reason }]
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  progress      FLOAT DEFAULT 0,
  output_key    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Individual segment renders for fan-out pipeline
CREATE TABLE IF NOT EXISTS render_segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id     UUID REFERENCES renders(id) ON DELETE CASCADE,
  idx           INT NOT NULL,
  in_t          FLOAT NOT NULL,
  out_t         FLOAT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  attempts      INT DEFAULT 0,
  output_key    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performant lookups
CREATE INDEX IF NOT EXISTS idx_jobs_asset ON jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_segments_asset ON segments(asset_id);
CREATE INDEX IF NOT EXISTS idx_segments_group ON segments(group_id);
CREATE INDEX IF NOT EXISTS idx_take_groups_asset ON take_groups(asset_id);
CREATE INDEX IF NOT EXISTS idx_renders_asset ON renders(asset_id);
CREATE INDEX IF NOT EXISTS idx_render_segments_render ON render_segments(render_id);

-- 8. Append-only Timeline Operations Log (Phase 2A)
CREATE TABLE IF NOT EXISTS timeline_ops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  op_type       TEXT NOT NULL,
  payload       JSONB NOT NULL,
  inverse       JSONB NOT NULL,
  actor         TEXT NOT NULL, -- 'user' | 'agent'
  agent_run_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (asset_id, seq)
);

-- 9. Timeline Snapshots (Phase 2A - for fast state reconstruction every 20 ops)
CREATE TABLE IF NOT EXISTS timeline_snapshots (
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  timeline      JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asset_id, seq)
);

-- 10. Agent Runs Tracker (Phase 2A)
CREATE TABLE IF NOT EXISTS agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  prompt        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'RUNNING', -- 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
  steps         JSONB DEFAULT '[]'::jsonb,
  model         TEXT,
  tokens_in     INT DEFAULT 0,
  tokens_out    INT DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_timeline_ops_asset ON timeline_ops(asset_id, seq);
CREATE INDEX IF NOT EXISTS idx_agent_runs_asset ON agent_runs(asset_id);

-- 11. Resumable Uploads Tracker (Phase 2C - TUS Protocol)
CREATE TABLE IF NOT EXISTS uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size        BIGINT NOT NULL,
  "offset"    BIGINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED' | 'UPLOADING' | 'COMPLETE' | 'EXPIRED' | 'TERMINATED'
  storage_key TEXT NOT NULL,
  filename    TEXT,
  mime        TEXT,
  asset_id    UUID REFERENCES assets(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uploads_expires ON uploads(expires_at) WHERE status != 'COMPLETE';
CREATE INDEX IF NOT EXISTS idx_uploads_asset ON uploads(asset_id);

-- 12. Video Linter Reports (Phase 2B)
CREATE TABLE IF NOT EXISTS lint_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id     UUID NOT NULL REFERENCES renders(id) ON DELETE CASCADE,
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  defect_count  INT NOT NULL DEFAULT 0,
  findings      JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration      FLOAT,
  lint_time_sec FLOAT,
  passed        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lint_reports_render ON lint_reports(render_id);
CREATE INDEX IF NOT EXISTS idx_lint_reports_asset ON lint_reports(asset_id);


