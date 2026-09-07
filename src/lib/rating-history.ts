import type { Player } from './types';
import { neon } from '@neondatabase/serverless';

export interface RatingPoint {
  playerId: number;
  rating: number;
  observedAt: string;
}

/** Storage-neutral contract for a hosted database adapter. */
export interface RatingHistoryStore {
  record(point: RatingPoint): Promise<void>;
  list(playerId: number, limit?: number): Promise<RatingPoint[]>;
}

/** Creates a safe snapshot only when the upstream rating is a finite positive number. */
export function ratingPoint(player: Pick<Player, 'id' | 'rating'> | null | undefined, observedAt = new Date().toISOString()): RatingPoint | null {
  if (!player) return null;
  const rating = player.rating;
  return Number.isInteger(player.id) && player.id > 0 && rating !== null
    && Number.isFinite(rating) && rating > 0
    ? { playerId: player.id, rating, observedAt }
    : null;
}

/** No local-disk fallback: serverless instances are ephemeral and must not lose history silently. */
export function configuredRatingStore(): RatingHistoryStore | null {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) return null;
  const sql = neon(connectionString);
  return {
    async record(point) {
      await sql`
        INSERT INTO player_rating_history (player_id, rating, observed_at)
        VALUES (${point.playerId}, ${point.rating}, ${point.observedAt}::timestamptz)
        ON CONFLICT (player_id, observed_at) DO UPDATE SET rating = EXCLUDED.rating
      `;
    },
    async list(playerId, limit = 24) {
      const rows = await sql`
        SELECT player_id, rating, observed_at
        FROM player_rating_history
        WHERE player_id = ${playerId}
        ORDER BY observed_at ASC
        LIMIT ${Math.max(1, Math.min(120, Math.floor(limit)))}
      `;
      return rows.map((row) => ({
        playerId: Number(row.player_id), rating: Number(row.rating),
        observedAt: new Date(String(row.observed_at)).toISOString(),
      }));
    },
  };
}
