import 'server-only';
import { getPlayerStatistics } from './api';
import type { ScoutPlayer } from './scouting';
import type { StatFilters } from './types';

export const DIVISIONS = [
  { key: 'premier', label: 'Premier' },
  { key: 'challenger', label: 'Challenger' },
  { key: 'ascendant', label: 'Ascendant' },
  { key: 'rising', label: 'Rising' },
] as const;
export type DivisionKey = (typeof DIVISIONS)[number]['key'] | 'all';

/** Fast route-page population. Never waits for the multi-query position index. */
async function fastStatistics(filters: StatFilters) {
  const result = await getPlayerStatistics({
    page: 1,
    pageSize: 60,
    sortBy: 'Rating',
    sortOrder: 'DESC',
    filters: { ...filters, includeSubstituteAppearances: true },
    revalidate: 300,
    timeoutMs: 20000,
  });
  return result?.items ?? [];
}

export async function loadScoutPlayers(scope: {
  period: number; region: number | null; minApps: number; minRating: number | null; division: DivisionKey;
}): Promise<{ players: ScoutPlayer[]; teamNames: Record<number, string>; positionWarning: boolean }> {
  // Do not block the route on complete all-time statistics plus 23 position
  // queries. That work routinely exceeds Vercel's 300-second limit. Position
  // evidence is intentionally unavailable in this fast view until a durable
  // background index exists; no role is inferred from aggregate stats.
  const [statistics, teamNames] = await Promise.all([
    fastStatistics({ timePeriod: scope.period, regionId: scope.region,
      minimumAppearances: scope.minApps, minimumRating: scope.minRating }),
    Promise.resolve({} as Record<number, string>),
  ]);
  const eligible = statistics;
  return {
    players: eligible.map((p) => ({ ...p, steamID: null, scoutPosition: null })),
    teamNames,
    positionWarning: eligible.length > 0,
  };
}
