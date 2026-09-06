import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  getMatch,
  getPlayer,
  getTeam,
  getTournament,
  safe,
} from './api';
import type { Match, Player, Team, Tournament } from './types';

/**
 * Request-deduplicated entity loaders.
 *
 * The upstream API answers 500 (not 404) for IDs that do not exist, so a null
 * result is treated as "not found". These are wrapped in React `cache()` so
 * generateMetadata and the page body share a single fetch, which lets us decide
 * the 404 before the response shell is flushed.
 */

export const loadPlayer = cache(
  async (id: number): Promise<Player | null> =>
    Number.isFinite(id) && id > 0 ? safe(getPlayer(id)) : null,
);

export const loadTeam = cache(
  async (id: number): Promise<Team | null> =>
    Number.isFinite(id) && id > 0 ? safe(getTeam(id)) : null,
);

export const loadMatch = cache(
  async (id: number): Promise<Match | null> =>
    Number.isFinite(id) && id > 0 ? safe(getMatch(id)) : null,
);

export const loadTournament = cache(
  async (id: number): Promise<Tournament | null> =>
    Number.isFinite(id) && id > 0 ? safe(getTournament(id)) : null,
);

/** Resolves the entity or terminates the render with a 404. */
export async function requireEntity<T>(p: Promise<T | null>): Promise<T> {
  const value = await p;
  if (!value) notFound();
  return value;
}
