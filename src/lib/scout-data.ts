import type { Paged, PlayerStatistics, SquadEntry } from './types';
import type { PositionGroup, ScoutPlayer } from './scouting';

export const RECORDED_POSITIONS: Record<string, PositionGroup> = {
  GK: 'GK',
  LWB: 'DEF', LB: 'DEF', LCB: 'DEF', SWP: 'DEF', CB: 'DEF', RCB: 'DEF', RB: 'DEF', RWB: 'DEF',
  LM: 'MID', LCM: 'MID', CDM: 'MID', CM: 'MID', CAM: 'MID', RCM: 'MID', RM: 'MID',
  LW: 'ATT', LF: 'ATT', CF: 'ATT', SS: 'ATT', ST: 'ATT', RF: 'ATT', RW: 'ATT',
};

/** A position qualifies only when every recorded second is accounted for. */
export function recordedPrimaryPosition(
  secondsByPosition: Record<string, number>,
  totalSeconds: number,
): ScoutPlayer['scoutPosition'] {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const entries = Object.entries(secondsByPosition);
  if (entries.some(([name, seconds]) => !Object.hasOwn(RECORDED_POSITIONS, name)
    || !Number.isFinite(seconds) || seconds < 0)) return null;
  const total = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
  if (Math.abs(total - totalSeconds) > 0.001) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const first = entries[0];
  if (!first || first[1] <= 0 || entries[1]?.[1] === first[1]) return null;
  const [name, secondsPlayed] = first;
  return { name, group: RECORDED_POSITIONS[name], secondsPlayed, share: secondsPlayed / total };
}

/** Fail closed instead of ranking a silently truncated or shifting population. */
export async function completePlayerPages(
  fetchPage: (page: number) => Promise<Paged<PlayerStatistics>>,
  maxPages = 100,
): Promise<PlayerStatistics[]> {
  const first = await fetchPage(1);
  if (!first || !Array.isArray(first.items) || !Number.isInteger(first.totalItems)
    || first.totalItems < 0 || !Number.isInteger(first.totalPages)
    || first.totalPages < 0 || first.totalPages > maxPages
    || (first.totalItems > 0 && first.totalPages === 0) || first.page !== 1) {
    throw new Error('Incomplete scouting statistics');
  }
  const rows: PlayerStatistics[] = [];
  const ids = new Set<number>();
  const append = (data: Paged<PlayerStatistics>, page: number) => {
    if (data.page !== page || data.totalItems !== first.totalItems
      || data.totalPages !== first.totalPages || !Array.isArray(data.items)
      || (page > 1 && data.items.length === 0)) throw new Error('Scouting population changed');
    for (const player of data.items) {
      if (!Number.isInteger(player.playerId) || ids.has(player.playerId)) {
        throw new Error('Duplicate or invalid scouting player');
      }
      ids.add(player.playerId);
      rows.push(player);
    }
  };
  append(first, 1);
  for (let page = 2; page <= first.totalPages; page++) append(await fetchPage(page), page);
  if (rows.length !== first.totalItems) throw new Error('Incomplete scouting population');
  return rows;
}

/** Squad membership, unlike historical team statistics, identifies today's club. */
export function currentSquadIds(squad: SquadEntry[]): number[] {
  return [...new Set(squad.filter(({ playerTeam: p }) => p
    && p.isCurrentTeam === true && p.isPending === false && p.leaveDate === null)
    .map(({ playerTeam }) => playerTeam.playerId))];
}
