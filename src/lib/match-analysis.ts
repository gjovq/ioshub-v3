import { StatIndex, positionGroupOf } from './enums';
import type { MatchData, MatchDataPlayer, MatchEvent } from './types';

export type Side = 'home' | 'away';

/** Read a named stat out of the positional statistics array. */
export function stat(arr: number[] | undefined, key: keyof typeof StatIndex): number {
  return arr?.[StatIndex[key]] ?? 0;
}

export interface SidePlayer {
  steamId64: string;
  steamId: string;
  name: string;
  side: Side;
  position: string;
  positionGroup: number;
  secondsPlayed: number;
  stats: number[];
  goals: number;
  assists: number;
  shots: number;
  shotsOnGoal: number;
  passes: number;
  passesCompleted: number;
  passAccuracy: number;
  interceptions: number;
  keeperSaves: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  distance: number;
  possession: number;
  chancesCreated: number;
  keyPasses: number;
  ownGoals: number;
  /** rough contribution score used only for ordering, never displayed as an official rating */
  impact: number;
}

/** Merge a player's per-period rows into one match total. */
export function flattenPlayer(p: MatchDataPlayer): SidePlayer | null {
  const rows = p.matchPeriodData ?? [];
  if (rows.length === 0) return null;

  const total = new Array(29).fill(0) as number[];
  let seconds = 0;
  for (const row of rows) {
    row.statistics?.forEach((v, i) => (total[i] += v ?? 0));
    seconds += Math.max(0, (row.info.endSecond ?? 0) - (row.info.startSecond ?? 0));
  }

  const last = rows[rows.length - 1].info;
  const position = last.position || '–';
  const passes = total[StatIndex.Passes];
  const passesCompleted = total[StatIndex.PassesCompleted];

  const goals = total[StatIndex.Goals];
  const assists = total[StatIndex.Assists];
  const saves = total[StatIndex.KeeperSaves];
  const interceptions = total[StatIndex.Interceptions];

  return {
    steamId64: p.info.steamId64,
    steamId: p.info.steamId,
    name: p.info.name,
    side: last.isHomeTeam ? 'home' : 'away',
    position,
    positionGroup: positionGroupOf(position),
    secondsPlayed: seconds,
    stats: total,
    goals,
    assists,
    shots: total[StatIndex.Shots],
    shotsOnGoal: total[StatIndex.ShotsOnGoal],
    passes,
    passesCompleted,
    passAccuracy: passes > 0 ? passesCompleted / passes : 0,
    interceptions,
    keeperSaves: saves,
    goalsConceded: total[StatIndex.GoalsConceded],
    yellowCards: total[StatIndex.YellowCards],
    redCards: total[StatIndex.RedCards],
    fouls: total[StatIndex.Fouls],
    distance: total[StatIndex.DistanceCovered],
    possession: total[StatIndex.Possession],
    chancesCreated: total[StatIndex.ChancesCreated],
    keyPasses: total[StatIndex.KeyPasses],
    ownGoals: total[StatIndex.OwnGoals],
    impact:
      goals * 4 +
      assists * 3 +
      total[StatIndex.SecondAssists] * 1.5 +
      total[StatIndex.ChancesCreated] * 1 +
      interceptions * 0.5 +
      saves * 1.5 +
      passesCompleted * 0.02 -
      total[StatIndex.OwnGoals] * 4 -
      total[StatIndex.RedCards] * 3,
  };
}

export function playersBySide(md: MatchData): Record<Side, SidePlayer[]> {
  const all = (md.players ?? [])
    .map(flattenPlayer)
    .filter((p): p is SidePlayer => p !== null);

  const order = (p: SidePlayer) => p.positionGroup;
  const sort = (a: SidePlayer, b: SidePlayer) =>
    order(a) - order(b) || b.secondsPlayed - a.secondsPlayed;

  return {
    home: all.filter((p) => p.side === 'home').sort(sort),
    away: all.filter((p) => p.side === 'away').sort(sort),
  };
}

export interface TeamTotals {
  name: string;
  side: Side;
  stats: number[];
  goals: number;
  shots: number;
  shotsOnGoal: number;
  passes: number;
  passesCompleted: number;
  passAccuracy: number;
  possession: number;
  interceptions: number;
  fouls: number;
  offsides: number;
  corners: number;
  yellowCards: number;
  redCards: number;
  keeperSaves: number;
  distance: number;
  slidingTackles: number;
}

export function teamTotals(md: MatchData): Record<Side, TeamTotals | null> {
  const out: Record<Side, TeamTotals | null> = { home: null, away: null };
  for (const t of md.teams ?? []) {
    const s = t.matchTotal.statistics ?? [];
    const passes = s[StatIndex.Passes] ?? 0;
    const completed = s[StatIndex.PassesCompleted] ?? 0;
    out[t.matchTotal.side] = {
      name: t.matchTotal.name,
      side: t.matchTotal.side,
      stats: s,
      goals: s[StatIndex.Goals] ?? 0,
      shots: s[StatIndex.Shots] ?? 0,
      shotsOnGoal: s[StatIndex.ShotsOnGoal] ?? 0,
      passes,
      passesCompleted: completed,
      passAccuracy: passes > 0 ? completed / passes : 0,
      possession: s[StatIndex.Possession] ?? 0,
      interceptions: s[StatIndex.Interceptions] ?? 0,
      fouls: s[StatIndex.Fouls] ?? 0,
      offsides: s[StatIndex.Offsides] ?? 0,
      corners: s[StatIndex.Corners] ?? 0,
      yellowCards: s[StatIndex.YellowCards] ?? 0,
      redCards: s[StatIndex.RedCards] ?? 0,
      keeperSaves: s[StatIndex.KeeperSaves] ?? 0,
      distance: s[StatIndex.DistanceCovered] ?? 0,
      slidingTackles: s[StatIndex.SlidingTackles] ?? 0,
    };
  }
  return out;
}

export interface TimelineEvent extends MatchEvent {
  playerName: string | null;
  assistName: string | null;
  minute: number;
  /** running score after this event */
  scoreHome: number;
  scoreAway: number;
}

const SCORING = new Set(['GOAL', 'OWN GOAL']);
export const NOTABLE_EVENTS = new Set([
  'GOAL',
  'OWN GOAL',
  'YELLOW CARD',
  'SECOND YELLOW',
  'RED CARD',
  'PENALTY',
  'PENALTY GOAL',
  'PENALTY MISS',
]);

export function buildTimeline(md: MatchData): TimelineEvent[] {
  const byId = new Map<string, string>();
  for (const p of md.players ?? []) {
    byId.set(p.info.steamId, p.info.name);
    byId.set(p.info.steamId64, p.info.name);
  }

  let home = 0;
  let away = 0;
  const out: TimelineEvent[] = [];

  for (const e of [...(md.matchEvents ?? [])].sort((a, b) => a.second - b.second)) {
    if (SCORING.has(e.event)) {
      // An own goal is recorded against the scoring player's own side.
      const credited = e.event === 'OWN GOAL' ? (e.team === 'home' ? 'away' : 'home') : e.team;
      if (credited === 'home') home++;
      else away++;
    }
    if (!NOTABLE_EVENTS.has(e.event)) continue;

    out.push({
      ...e,
      playerName: byId.get(e.player1SteamId) ?? null,
      assistName: e.player2SteamId ? (byId.get(e.player2SteamId) ?? null) : null,
      minute: Math.max(1, Math.round(e.second / 60)),
      scoreHome: home,
      scoreAway: away,
    });
  }
  return out;
}

/** All shots with pitch coordinates, for the shot map. */
export function shotEvents(md: MatchData) {
  const byId = new Map<string, string>();
  for (const p of md.players ?? []) byId.set(p.info.steamId, p.info.name);

  return (md.matchEvents ?? [])
    .filter(
      (e) =>
        ['GOAL', 'MISS', 'SAVE', 'OWN GOAL'].includes(e.event) && e.startPosition != null,
    )
    .map((e) => ({
      ...e,
      playerName: byId.get(e.player1SteamId) ?? 'Unknown',
      isGoal: e.event === 'GOAL',
      minute: Math.max(1, Math.round(e.second / 60)),
    }));
}

export function topPerformers(md: MatchData, n = 3): SidePlayer[] {
  const { home, away } = playersBySide(md);
  return [...home, ...away].sort((a, b) => b.impact - a.impact).slice(0, n);
}

export function matchDuration(md: MatchData): number {
  const info = md.matchInfo;
  if (info?.endTime && info?.startTime) return info.endTime - info.startTime;
  return 0;
}
