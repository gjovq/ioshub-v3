import 'server-only';
import { unstable_cache } from 'next/cache';
import { getCurrentTournaments, getPlayerStatistics, getTeamSquad, getTournamentTeams } from './api';
import { completePlayerPages, currentSquadIds, RECORDED_POSITIONS, recordedPrimaryPosition } from './scout-data';
import type { ScoutPlayer } from './scouting';
import type { StatFilters } from './types';

export const DIVISIONS = [
  { key: 'premier', label: 'Premier' },
  { key: 'challenger', label: 'Challenger' },
  { key: 'ascendant', label: 'Ascendant' },
  { key: 'rising', label: 'Rising' },
] as const;
export type DivisionKey = (typeof DIVISIONS)[number]['key'] | 'all';

async function allStatistics(filters: StatFilters) {
  return completePlayerPages((page) => getPlayerStatistics({
    page, pageSize: 1000, sortBy: 'SecondsPlayed', sortOrder: 'DESC',
    filters: { ...filters, includeSubstituteAppearances: true },
    // A 1000-row response can exceed Next's 2 MB data-cache limit. The
    // complete population is validated in memory and must not be cached as a
    // serialized fetch result; smaller API calls keep their normal caches.
    revalidate: 0, timeoutMs: 45000,
  }));
}

/** Small derived index, shared between scouting scopes. No profile-label fallback. */
const recordedPositionIndex = unstable_cache(async () => {
  const totals = await allStatistics({ timePeriod: 0 });
  const byPlayer = new Map(totals.map((p) => [p.playerId, {} as Record<string, number>]));
  const names = Object.keys(RECORDED_POSITIONS);
  // At most three expensive statistics queries at once, including pagination.
  for (let offset = 0; offset < names.length; offset += 3) {
    await Promise.all(names.slice(offset, offset + 3).map(async (positionName) => {
      const rows = await allStatistics({ timePeriod: 0, positionName });
      for (const row of rows) {
        const distribution = byPlayer.get(row.playerId);
        if (!distribution) throw new Error('Position population changed during refresh');
        distribution[positionName] = row.secondsPlayed;
      }
    }));
  }
  return {
    refreshedAt: new Date().toISOString(),
    positions: Object.fromEntries(totals.map((p) => [p.playerId,
      recordedPrimaryPosition(byPlayer.get(p.playerId)!, p.secondsPlayed)])),
  };
}, ['scout-recorded-position-index-v1'], { revalidate: 3600 });

/**
 * Do not wrap this complete population in `unstable_cache`: Next.js refuses
 * cache entries larger than 2 MB, and a full scouting population can exceed
 * 11 MB. Each upstream page is already cached by `api.ts`, so removing this
 * aggregate cache avoids the exception without disabling page-level caching.
 */
function statisticsForScope(period: number, region: number | null, minApps: number, minRating: number | null) {
  return allStatistics({
    timePeriod: period,
    regionId: region,
    minimumAppearances: minApps,
    minimumRating: minRating,
  });
}

const divisionMembers = unstable_cache(async (division: Exclude<DivisionKey, 'all'>) => {
  const tournaments = await getCurrentTournaments();
  const tournament = tournaments.find((t) => t.name.toLowerCase().startsWith(division));
  if (!tournament) throw new Error('Current division unavailable');
  const teams = await getTournamentTeams(tournament.id);
  const names: Record<number, string> = {};
  for (let offset = 0; offset < teams.length; offset += 3) {
    await Promise.all(teams.slice(offset, offset + 3).map(async (team) => {
      const squad = await getTeamSquad(team.id);
      for (const id of currentSquadIds(squad)) names[id] = team.name;
    }));
  }
  return names;
}, ['scout-current-division-members-v1'], { revalidate: 900 });

export async function loadScoutPlayers(scope: {
  period: number; region: number | null; minApps: number; minRating: number | null; division: DivisionKey;
}): Promise<{ players: ScoutPlayer[]; teamNames: Record<number, string>; positionWarning: boolean }> {
  const [statistics, teamNames] = await Promise.all([
    statisticsForScope(scope.period, scope.region, scope.minApps, scope.minRating),
    scope.division === 'all' ? Promise.resolve({} as Record<number, string>) : divisionMembers(scope.division),
  ]);
  const eligible = scope.division === 'all' ? statistics
    : statistics.filter((p) => Object.hasOwn(teamNames, p.playerId));
  // A failed position query cannot become zero minutes or a made-up role.
  const index = eligible.length ? await recordedPositionIndex().catch(() => null) : null;
  return {
    players: eligible.map((p) => ({ ...p, steamID: null, scoutPosition: index?.positions[p.playerId] ?? null })),
    teamNames,
    positionWarning: eligible.some((p) => !index?.positions[p.playerId]),
  };
}
