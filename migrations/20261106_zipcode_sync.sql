CREATE TABLE IF NOT EXISTS zipcode_sync_status (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  run_id UUID,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ,
  worker_started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  source_hashes JSONB,
  summary JSONB,
  error TEXT
);
INSERT INTO zipcode_sync_status (singleton) VALUES (TRUE) ON CONFLICT DO NOTHING;
