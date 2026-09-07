import type { PlayerStatistics } from './types';

/**
 * Scouting maths. Everything here is computed client-side from the aggregate
 * PlayerStatistics the API returns — no upstream endpoint provides percentiles,
 * so normalisation references are hand-tuned against the live leaderboard
 * distribution (see REFERENCE below).
 */

/** Per-90 or per-match rates are what matter when comparing players. */
export interface ScoutProfile {
  label: string;
  /** normalised 0..1 against REFERENCE */
  value: number;
  /** raw number behind the normalised value, shown in tooltips */
  raw: number;
}

/**
 * Reference maxima for normalisation, set to roughly the 95th percentile of
 * each rate across all positions. A value of 1.0 on an axis means "elite, top
 * few percent of the hub" — deliberately harsh so shapes differentiate.
 */
const REFERENCE = {
  goalsPerMatch: 1.1,
  assistsPerMatch: 0.9,
  shotsPerMatch: 4.5,
  passAccuracy: 0.92, // fraction
  keyPassesPerMatch: 1.6,
  chancesPerMatch: 1.8,
  interceptionsPerMatch: 4.5,
  tacklesPerMatch: 2.2,
  savesPerMatch: 6.0,
  savePct: 0.78, // fraction
  distancePerMatch: 7.5, // km
  discipline: 0.9, // fouls per match inverted
  winRate: 75, // %
  xgPerMatch: 0.95,
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function perMatch(total: number, apps: number): number {
  return apps > 0 ? total / apps : 0;
}

/** Keepers are judged on a different hexagon to everyone else. */
export function isKeeper(p: PlayerStatistics): boolean {
  // Keepers rack up saves and rarely score; heuristics on the aggregate.
  return (
    p.keeperSaves > 0 &&
    p.keeperSaves / Math.max(1, p.appearances) > 1.5 &&
    p.goals / Math.max(1, p.appearances) < 0.25
  );
}

/** Six-axis hexagon profile, shaped by position. */
export function hexagonAxes(p: PlayerStatistics): ScoutProfile[] {
  const apps = Math.max(1, p.appearances);
  const r = REFERENCE;

  if (isKeeper(p)) {
    return [
      { label: 'Saves', value: clamp01(perMatch(p.keeperSaves, apps) / r.savesPerMatch), raw: perMatch(p.keeperSaves, apps) },
      { label: 'Save %', value: clamp01((p.keeperSavePercentage ?? 0) / r.savePct), raw: p.keeperSavePercentage ?? 0 },
      { label: 'Passing', value: clamp01(p.passCompletionPercentageAverage / 100 / r.passAccuracy), raw: p.passCompletionPercentageAverage },
      { label: 'Clean sheets', value: clamp01(1 - perMatch(p.goalsConceded, apps) / 3), raw: perMatch(p.goalsConceded, apps) },
      { label: 'Consistency', value: clamp01(p.winPercentage / r.winRate), raw: p.winPercentage },
      { label: 'Volume', value: clamp01(p.appearances / 100), raw: p.appearances },
    ];
  }

  return [
    { label: 'Goals', value: clamp01(perMatch(p.goals, apps) / r.goalsPerMatch), raw: perMatch(p.goals, apps) },
    { label: 'Assists', value: clamp01(perMatch(p.assists, apps) / r.assistsPerMatch), raw: perMatch(p.assists, apps) },
    { label: 'Shooting', value: clamp01(perMatch(p.shots, apps) / r.shotsPerMatch), raw: perMatch(p.shots, apps) },
    { label: 'Passing', value: clamp01((p.passCompletionPercentageAverage / 100) / r.passAccuracy), raw: p.passCompletionPercentageAverage },
    { label: 'Creating', value: clamp01(perMatch(p.keyPasses + p.chancesCreated, apps) / (r.keyPassesPerMatch + r.chancesPerMatch)), raw: perMatch(p.keyPasses + p.chancesCreated, apps) },
    { label: 'Defending', value: clamp01(perMatch(p.interceptions, apps) / r.interceptionsPerMatch), raw: perMatch(p.interceptions, apps) },
  ];
}

/**
 * Scout heatmap score: 0..100, "how interesting is this player right now".
 * Blends output (goals+assists), progression (passing+creation), involvement
 * (minutes share), winning and availability, weighted by what a scout cares
 * about: output and creation dominate; discipline dings slightly.
 */
export function scoutScore(p: PlayerStatistics): number {
  const apps = Math.max(1, p.appearances);
  const g = perMatch(p.goals, apps);
  const a = perMatch(p.assists, apps);
  const kp = perMatch(p.keyPasses + p.chancesCreated, apps);
  const pass = (p.passCompletionPercentageAverage / 100) / REFERENCE.passAccuracy;
  const win = p.winPercentage / REFERENCE.winRate;
  const mins = clamp01(p.secondsPlayed / Math.max(1, apps) / (90 * 60)); // full-match share
  const discipline = clamp01(1 - perMatch(p.fouls + p.yellowCards + p.redCards * 3, apps) / 4);

  const score =
    0.30 * clamp01((g / REFERENCE.goalsPerMatch + a / REFERENCE.assistsPerMatch) / 1.6) +
    0.22 * clamp01(kp / (REFERENCE.keyPassesPerMatch + REFERENCE.chancesPerMatch)) +
    0.18 * clamp01(pass) +
    0.12 * clamp01(win) +
    0.10 * mins +
    0.08 * discipline;

  return Math.round(clamp01(score) * 100);
}

/** Position group from PITCH_POSITIONS conventions in the API. */
export function positionGroupOfStats(p: PlayerStatistics): 'GK' | 'DEF' | 'MID' | 'ATT' | 'MIX' {
  if (isKeeper(p)) return 'GK';
  const apps = Math.max(1, p.appearances);
  const g = perMatch(p.goals, apps);
  const int = perMatch(p.interceptions, apps);
  if (g > 0.45) return 'ATT';
  if (int > 2.2) return 'DEF';
  if (g > 0.15 || perMatch(p.assists, apps) > 0.25) return 'MID';
  return 'MIX';
}

export const POSITION_COLORS: Record<string, string> = {
  GK: '#38bdf8',
  DEF: '#a78bfa',
  MID: '#22c55e',
  ATT: '#f97316',
  MIX: '#94a3b8',
};
