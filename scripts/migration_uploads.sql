CREATE TABLE IF NOT EXISTS uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size        BIGINT NOT NULL,
  "offset"    BIGINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'CREATED',
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
