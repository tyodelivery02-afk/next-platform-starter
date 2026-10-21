CREATE TABLE IF NOT EXISTS line_cargo_registrations (
  code TEXT PRIMARY KEY CHECK (code ~ '^E[A-Z0-9]{11}$'),
  state TEXT NOT NULL CHECK (state IN ('processing','registered','failed','unknown')),
  attempt_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
