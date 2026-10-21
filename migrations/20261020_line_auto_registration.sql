ALTER TABLE line_ocr_events ADD COLUMN IF NOT EXISTS recognized_at TIMESTAMPTZ;
UPDATE line_ocr_events SET recognized_at = received_at WHERE completed AND recognized_at IS NULL;
CREATE INDEX IF NOT EXISTS line_ocr_events_recognized_idx ON line_ocr_events(recognized_at) WHERE completed;
