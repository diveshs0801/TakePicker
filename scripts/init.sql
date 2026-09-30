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
