-- No image bytes, image URLs, message IDs, group IDs or full OCR text are stored.
CREATE TABLE IF NOT EXISTS line_ocr_events (
  event_id TEXT PRIMARY KEY,
  codes TEXT[] NOT NULL DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  lease_until TIMESTAMPTZ,
  lease_token TEXT,
  CHECK (array_length(codes, 1) IS NULL OR array_length(codes, 1) <= 200)
);
CREATE INDEX IF NOT EXISTS line_ocr_events_received_idx
  ON line_ocr_events (received_at DESC, event_id DESC) WHERE completed;
