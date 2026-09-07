import 'server-only';
import { getPlayerStatistics } from './api';
import { configuredPositionStore } from './rating-history';
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
  const [statistics, teamNames] = await Promise.all([
    fastStatistics({ timePeriod: scope.period, regionId: scope.region,
      minimumAppearances: scope.minApps, minimumRating: scope.minRating }),
    Promise.resolve({} as Record<number, string>),
  ]);
  const eligible = statistics;
  const positionStore = configuredPositionStore();
  const positions = positionStore ? await positionStore.get(eligible.map((p) => p.playerId)) : new Map();
  return {
    players: eligible.map((p) => ({ ...p, steamID: null, scoutPosition: positions.get(p.playerId) ?? null })),
    teamNames,
    positionWarning: eligible.some((p) => !positions.has(p.playerId)),
  };
}
