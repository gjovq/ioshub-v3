import type { LiveServerSnapshot } from './types';

const STATS = ['score', 'ball_possession', 'corner_kicks', 'goal_kicks', 'passes',
  'interceptions', 'free_kicks', 'penalties', 'saves', 'offsides'] as const;

function record(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    out[key] = raw;
  }
  return out;
}

function side(value: unknown): LiveServerSnapshot['home'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const stats = record(input.stats);
  if (!stats || STATS.some((key) => !Number.isFinite(stats[key]))) return null;
  if (!Array.isArray(input.players)) return null;
  const players = input.players.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const p = raw as Record<string, unknown>;
    return typeof p.id === 'string' && typeof p.name === 'string'
      && typeof p.goals === 'number' && Number.isFinite(p.goals)
      && typeof p.assists === 'number' && Number.isFinite(p.assists)
      && typeof p.field_position === 'number' && Number.isFinite(p.field_position)
      ? { id: p.id, name: p.name, goals: p.goals, assists: p.assists, field_position: p.field_position }
      : null;
  });
  return players.every(Boolean) ? { stats, players: players as LiveServerSnapshot['home']['players'] } : null;
}

/** Safely accepts the server snapshot without logging or treating it as API LiveScoreState. */
export function parseLiveServerSnapshot(value: unknown): LiveServerSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const home = side(input.home);
  const away = side(input.away);
  const server = input.server;
  const ga = input.goals_and_assists;
  if (!home || !away || !server || typeof server !== 'object' || Array.isArray(server)
    || typeof (server as Record<string, unknown>).timestamp !== 'number'
    || typeof (server as Record<string, unknown>).match_state !== 'string'
    || !ga || typeof ga !== 'object' || Array.isArray(ga)) return null;
  const goals = ga as Record<string, unknown>;
  const homeGoals = record(goals.home_goals);
  const awayGoals = record(goals.away_goals);
  const homeAssists = record(goals.home_assists);
  const awayAssists = record(goals.away_assists);
  if (!homeGoals || !awayGoals || !homeAssists || !awayAssists) return null;
  return {
    home, away,
    server: server as LiveServerSnapshot['server'],
    goals_and_assists: {
      home_goals: homeGoals, away_goals: awayGoals,
      home_assists: homeAssists, away_assists: awayAssists,
    },
  };
}
