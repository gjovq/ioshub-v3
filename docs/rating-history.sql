-- Run once in the hosted Neon/Vercel Postgres database before enabling snapshots.
CREATE TABLE IF NOT EXISTS player_rating_history (
  player_id INTEGER NOT NULL,
  rating DOUBLE PRECISION NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (player_id, observed_at)
);

CREATE INDEX IF NOT EXISTS player_rating_history_player_time_idx
  ON player_rating_history (player_id, observed_at ASC);
