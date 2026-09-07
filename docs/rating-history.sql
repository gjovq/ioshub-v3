-- Run once in the hosted Neon/Vercel Postgres database before enabling snapshots.
CREATE TABLE IF NOT EXISTS player_rating_history (
  player_id INTEGER NOT NULL,
  rating DOUBLE PRECISION NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (player_id, observed_at)
);

CREATE INDEX IF NOT EXISTS player_rating_history_player_time_idx
  ON player_rating_history (player_id, observed_at ASC);

CREATE TABLE IF NOT EXISTS player_recorded_positions (
  player_id INTEGER PRIMARY KEY,
  position_name TEXT NOT NULL,
  position_group TEXT NOT NULL CHECK (position_group IN ('GK','DEF','MID','ATT')),
  seconds_played BIGINT NOT NULL,
  share DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
