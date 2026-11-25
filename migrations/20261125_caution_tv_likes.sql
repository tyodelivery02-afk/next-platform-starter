CREATE TABLE IF NOT EXISTS caution_tv_likes (
    vote_id uuid PRIMARY KEY,
    video_id text NOT NULL CHECK (video_id ~ '^[A-Za-z0-9_-]{11}$')
);

CREATE INDEX IF NOT EXISTS caution_tv_likes_video_idx ON caution_tv_likes (video_id);
