CREATE TABLE IF NOT EXISTS caution_stat_accounts (
    account_id text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS caution_daily_statistics (
    account_id text NOT NULL REFERENCES caution_stat_accounts(account_id),
    installation_id uuid NOT NULL,
    day date NOT NULL,
    counts jsonb NOT NULL CHECK (jsonb_typeof(counts) = 'object'),
    PRIMARY KEY (account_id, installation_id, day)
);
