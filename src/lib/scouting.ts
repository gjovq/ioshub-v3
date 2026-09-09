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
  /** how the raw value is composed, shown in the UI */
  formula: string;
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
      { label: 'Saves', value: clamp01(perMatch(p.keeperSaves, apps) / r.savesPerMatch), raw: perMatch(p.keeperSaves, apps), formula: 'keeper saves ÷ matches' },
      { label: 'Save %', value: clamp01((p.keeperSavePercentage ?? 0) / r.savePct), raw: p.keeperSavePercentage ?? 0, formula: 'keeper saves ÷ shots on target' },
      { label: 'Passing', value: clamp01(p.passCompletionPercentageAverage / r.passAccuracy), raw: p.passCompletionPercentageAverage, formula: 'passes completed ÷ attempted' },
      { label: 'Clean sheets', value: clamp01(1 - perMatch(p.goalsConceded, apps) / 3), raw: perMatch(p.goalsConceded, apps), formula: '1 − (conceded ÷ matches) ÷ 3' },
      { label: 'Consistency', value: clamp01(p.winPercentage / (r.winRate / 100)), raw: p.winPercentage, formula: 'wins ÷ matches' },
      { label: 'Volume', value: clamp01(p.appearances / 100), raw: p.appearances, formula: 'matches played' },
    ];
  }

  return [
    { label: 'Goals', value: clamp01(perMatch(p.goals, apps) / r.goalsPerMatch), raw: perMatch(p.goals, apps), formula: 'goals ÷ matches' },
    { label: 'Assists', value: clamp01(perMatch(p.assists, apps) / r.assistsPerMatch), raw: perMatch(p.assists, apps), formula: 'assists ÷ matches' },
    { label: 'Shooting', value: clamp01(perMatch(p.shots, apps) / r.shotsPerMatch), raw: perMatch(p.shots, apps), formula: 'shots ÷ matches' },
    { label: 'Passing', value: clamp01(p.passCompletionPercentageAverage / r.passAccuracy), raw: p.passCompletionPercentageAverage, formula: 'passes completed ÷ attempted' },
    { label: 'Creating', value: clamp01(perMatch(p.keyPasses + p.chancesCreated, apps) / (r.keyPassesPerMatch + r.chancesPerMatch)), raw: perMatch(p.keyPasses + p.chancesCreated, apps), formula: '(key passes + chances) ÷ matches' },
    { label: 'Defending', value: clamp01(perMatch(p.interceptions, apps) / r.interceptionsPerMatch), raw: perMatch(p.interceptions, apps), formula: 'interceptions ÷ matches' },
  ];
}

/**
 * Role-specific axes, each a composite formula over aggregate stats. Formulas
 * are deliberately transparent (e.g. "chances created" blends key passes,
 * assists at double weight and created chances) so the UI can show exactly how
 * every number is derived. Roles are ESTIMATED from aggregate statistics.
 */
export function roleAxes(p: PlayerStatistics): ScoutProfile[] {
  const a = Math.max(1, p.appearances), r = REFERENCE;
  const rate = (n: number) => perMatch(n, a);
  const axis = (label: string, raw: number, max: number, formula: string): ScoutProfile => ({ label, raw, value: clamp01(raw / max), formula });
  const minutes = p.secondsPlayed / (a * 5400); // share of full 90-minute matches
  const win = p.winPercentage; // fraction 0..1
  const pass = p.passCompletionPercentageAverage; // fraction 0..1
  // Fraction of shots faced that were saved — inherently 0..1, never clamps to
  // 0 like "1 − conceded/m ÷ 3" did for real keepers (conceded/m ≈ 2.6–4.0).
  const saveRate = p.keeperSaves + p.goalsConceded > 0 ? p.keeperSaves / (p.keeperSaves + p.goalsConceded) : 0;
  switch (positionGroupOfStats(p)) {
    case 'GK': return [
      axis('Save %', p.keeperSavePercentage ?? 0, r.savePct, 'keeper saves ÷ shots on target'),
      axis('Saves /match', rate(p.keeperSaves), r.savesPerMatch, 'keeper saves ÷ matches'),
      axis('Goals prevented', clamp01(1 - rate(p.goalsConceded) / 6), 1, '1 − (conceded ÷ matches) ÷ 6'),
      axis('Passing', pass, r.passAccuracy, 'pass completion % (match-independent)'),
      axis('Wins', win, r.winRate / 100, 'wins ÷ matches'),
      axis('Minutes', minutes, 1, 'seconds ÷ (matches × 90 min)'),
    ];
    case 'DEF': return [
      axis('Def. actions /m', rate(p.interceptions) + p.slidingTacklesCompletedAverage, r.interceptionsPerMatch + r.tacklesPerMatch, 'interceptions/m + tackles/m'),
      axis('Goal prevention', saveRate, 0.65, 'saves ÷ (saves + conceded)'),
      axis('Passing', pass, r.passAccuracy, 'pass completion % (match-independent)'),
      axis('Possession', p.possessionPercentageAverage, 0.6, 'avg possession share (fraction)'),
      axis('Wins', win, r.winRate / 100, 'wins ÷ matches'),
      axis('Minutes', minutes, 1, 'seconds ÷ (matches × 90 min)'),
    ];
    case 'MID': return [
      axis('Chances created /m', rate(p.keyPasses) + 2 * rate(p.assists) + rate(p.chancesCreated), 4.5, 'key passes/m + 2 × assists/m + chances/m'),
      axis('Goals /m', rate(p.goals), r.goalsPerMatch, 'goals ÷ matches'),
      axis('Passing', pass, r.passAccuracy, 'passes completed ÷ attempted'),
      axis('Possession', p.possessionPercentageAverage, 0.6, 'avg possession share (fraction)'),
      axis('Work rate', p.distanceCoveredAverage, 9000, 'avg metres per match ÷ 9 km'),
      axis('Minutes', minutes, 1, 'seconds ÷ (matches × 90 min)'),
    ];
    default: return [
      axis('Output /m', rate(p.goals) + 0.8 * rate(p.assists), 1.7, 'goals/m + 0.8 × assists/m'),
      axis('Conversion', p.shotConversionPercentage, 0.3, 'goals ÷ shots (capped at 30%)'),
      axis('Shot volume /m', rate(p.shots), r.shotsPerMatch, 'shots ÷ matches'),
      axis('Accuracy', p.shotAccuracyPercentage, 0.6, 'shots on target ÷ shots'),
      axis('Fouls drawn /m', rate(p.foulsSuffered), 2.5, 'fouls suffered ÷ matches'),
      axis('Minutes', minutes, 1, 'seconds ÷ (matches × 90 min)'),
    ];
  }
}

/** Midrank percentile among the supplied, already role-compatible cohort. */
export function percentile(value: number, peers: number[]): number | null {
  const valid = peers.filter(Number.isFinite);
  if (!Number.isFinite(value) || valid.length < 5) return null;
  // Degenerate axis: every peer shares the same value (e.g. xG is 0 for the
  // whole cohort), so a percentile is meaningless — fall back to the raw value
  // instead of reporting a flat "50th".
  if (valid.every((x) => x === valid[0])) return null;
  const below = valid.filter((x) => x < value).length;
  const equal = valid.filter((x) => x === value).length;
  return (below + (equal + 1) / 2) / valid.length;
}

/**
 * Same-role percentile bars. Compares the player's raw value on each role axis
 * against the same axis of every other player in the same ESTIMATED role group
 * from the full loaded cohort (search does not change the cohort).
 */
export function rolePercentiles(p: PlayerStatistics, cohort: PlayerStatistics[]) {
  const axes = roleAxes(p);
  const role = positionGroupOfStats(p);
  const peers = cohort.filter((x) => positionGroupOfStats(x) === role);
  return axes.map((axis, i) => ({
    ...axis,
    percentile: percentile(axis.raw, peers.map((x) => roleAxes(x)[i]?.raw ?? NaN)),
  }));
}

/**
 * Role-relative scout heat: the player's mean percentile across their role's
 * six axes, among the same-role peers in the loaded cohort. Because every
 * player is scored only against their own role, the best GK and the best CF
 * can both reach ~100 — unlike the old absolute blend where GKs topped out
 * around 65 while attackers neared 96. Falls back to the mean normalised axis
 * value when the role has fewer than five peers for percentiles.
 */
export function roleHeat(p: PlayerStatistics, cohort: PlayerStatistics[]): number {
  const bars = rolePercentiles(p, cohort);
  const pcts = bars.map((b) => b.percentile).filter((v): v is number => v != null);
  if (pcts.length === bars.length && pcts.length > 0) {
    return Math.round((pcts.reduce((s, v) => s + v, 0) / pcts.length) * 100);
  }
  const vals = roleAxes(p).map((a) => a.value);
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100);
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
  const pass = p.passCompletionPercentageAverage / REFERENCE.passAccuracy;
  const win = p.winPercentage / (REFERENCE.winRate / 100);
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
