import type { PlayerStatistics } from './types';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface ScoutPlayer extends PlayerStatistics {
  /** Most-played recorded position, supplied by the data layer; never inferred. */
  scoutPosition: {
    name: string;
    group: PositionGroup;
    secondsPlayed: number;
    /** Fraction of recorded position time (0..1). */
    share: number;
  } | null;
}

export const POSITION_COLORS: Record<PositionGroup, string> = {
  GK: '#38bdf8',
  DEF: '#a78bfa',
  MID: '#22c55e',
  ATT: '#f97316',
};

export function primaryPosition(p: ScoutPlayer): PositionGroup | null {
  return p.scoutPosition?.group ?? null;
}

/** Midrank within finite observations; ties (including a singleton) are neutral. */
export function percentileOf(
  value: number,
  values: readonly number[],
  lowerIsBetter = false,
): number | null {
  if (!Number.isFinite(value)) return null;
  let count = 0;
  let below = 0;
  let equal = 0;
  for (const observation of values) {
    if (!Number.isFinite(observation)) continue;
    count++;
    if (observation < value) below++;
    if (observation === value) equal++;
  }
  if (count === 0) return null;
  const rank = ((below + equal / 2) / count) * 100;
  return Math.max(0, Math.min(100, lowerIsBetter ? 100 - rank : rank));
}

function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function fraction(value: unknown): number | null {
  const valid = nonnegative(value);
  return valid !== null && valid <= 1 ? valid : null;
}

function ratio(numerator: unknown, denominator: unknown): number | null {
  const n = nonnegative(numerator);
  const d = nonnegative(denominator);
  return n !== null && d !== null && d > 0 ? nonnegative(n / d) : null;
}

/** Percentage fields are fractions, never values to divide by 100. */
function accuracy(reported: unknown, completed: unknown, attempts: unknown): number | null {
  const count = nonnegative(attempts);
  if (count === null || count === 0) return null;
  return fraction(reported) ?? fraction(ratio(completed, count));
}

export function passAccuracy(p: PlayerStatistics): number | null {
  return accuracy(p.passCompletionPercentageAverage, p.passesCompleted, p.passes);
}

function saveAccuracy(p: PlayerStatistics): number | null {
  const saves = nonnegative(p.keeperSaves);
  const conceded = nonnegative(p.goalsConceded);
  if (saves === null || conceded === null) return null;
  return accuracy(p.keeperSavePercentage, saves, saves + conceded);
}

export interface ScoutAxis {
  label: string;
  /** Per-appearance rate, or a 0..1 fraction for percent units. */
  raw: number | null;
  /** Same recorded position-group midrank (0..100), not a global rank. */
  pct: number | null;
  unit: 'rate' | 'percent';
  lowerIsBetter: boolean;
}

interface AxisDefinition {
  label: string;
  unit: ScoutAxis['unit'];
  lowerIsBetter: boolean;
  weight: number;
  value: (p: PlayerStatistics) => number | null;
}

function rate(
  label: string,
  weight: number,
  total: (p: PlayerStatistics) => unknown,
  lowerIsBetter = false,
): AxisDefinition {
  return { label, weight, unit: 'rate', lowerIsBetter, value: (p) => ratio(total(p), p.appearances) };
}

function average(
  label: string,
  weight: number,
  value: (p: PlayerStatistics) => unknown,
): AxisDefinition {
  return {
    label, weight, unit: 'rate', lowerIsBetter: false,
    value: (p) => nonnegative(p.appearances) !== null && p.appearances > 0 ? nonnegative(value(p)) : null,
  };
}

function percent(
  label: string,
  weight: number,
  value: AxisDefinition['value'],
): AxisDefinition {
  return { label, weight, unit: 'percent', lowerIsBetter: false, value };
}

// Transparent role-specific product weights, not learned or calibrated ratings.
// Every role has six distinct football axes; weights in each role sum to 1.
const ROLE_AXES: Record<PositionGroup, readonly AxisDefinition[]> = {
  GK: [
    rate('Saves', 0.30, (p) => p.keeperSaves),
    percent('Save %', 0.35, saveAccuracy),
    rate('Conceded', 0.15, (p) => p.goalsConceded, true),
    percent('Passing', 0.10, passAccuracy),
    average('Catches', 0.05, (p) => p.keeperSavesCaughtAverage),
    percent('Winning', 0.05, (p) => accuracy(p.winPercentage, p.wins, p.appearances)),
  ],
  DEF: [
    rate('Interceptions', 0.30, (p) => p.interceptions),
    average('Tackles', 0.25, (p) => p.slidingTacklesCompletedAverage),
    rate('Conceded', 0.15, (p) => p.goalsConceded, true),
    percent('Passing', 0.15, passAccuracy),
    rate('Key passes', 0.10, (p) => p.keyPasses),
    rate('Fouls', 0.05, (p) => p.fouls, true),
  ],
  MID: [
    rate('Key passes', 0.25, (p) => p.keyPasses),
    rate('Chances', 0.20, (p) => p.chancesCreated),
    rate('Assists', 0.20, (p) => p.assists),
    percent('Passing', 0.20, passAccuracy),
    rate('Interceptions', 0.10, (p) => p.interceptions),
    rate('Goals', 0.05, (p) => p.goals),
  ],
  ATT: [
    rate('Goals', 0.35, (p) => p.goals),
    percent('Conversion', 0.20, (p) => accuracy(p.shotConversionPercentage, p.goals, p.shots)),
    percent('Shot accuracy', 0.15, (p) => accuracy(p.shotAccuracyPercentage, p.shotsOnGoal, p.shots)),
    rate('Shots', 0.10, (p) => p.shots),
    rate('Assists', 0.10, (p) => p.assists),
    rate('Key passes', 0.10, (p) => p.keyPasses),
  ],
};

const MIN_PEERS = 5;

function roleValues(group: PositionGroup, cohort: readonly ScoutPlayer[]): number[][] {
  const peers = cohort.filter((p) => primaryPosition(p) === group);
  return ROLE_AXES[group].map((axis) => peers
    .map((p) => axis.value(p))
    .filter((value): value is number => value !== null && Number.isFinite(value)));
}

function axesFor(p: ScoutPlayer, group: PositionGroup, values: number[][]): ScoutAxis[] {
  return ROLE_AXES[group].map((axis, index) => {
    const raw = axis.value(p);
    return {
      label: axis.label,
      raw,
      pct: raw === null || values[index].length < MIN_PEERS
        ? null
        : percentileOf(raw, values[index], axis.lowerIsBetter),
      unit: axis.unit,
      lowerIsBetter: axis.lowerIsBetter,
    };
  });
}

/**
 * Six role axes, or [] when the recorded role is unknown. Pass the full fetched
 * cohort, BEFORE client-side name filtering. Only same-role observations count;
 * each axis needs at least five valid observations before showing a percentile.
 */
export function hexagonFor(p: ScoutPlayer, cohort: ScoutPlayer[]): ScoutAxis[] {
  const group = primaryPosition(p);
  return group === null ? [] : axesFor(p, group, roleValues(group, cohort));
}

/**
 * Weighted mean of same-role axis percentiles, NOT a percentile of the composite
 * and NOT a global rank. Missing axes are omitted and available weights are
 * renormalized; no supported axes or an unknown role produces null. Compute on
 * the full fetched cohort before applying any client-side name filter.
 */
export function heatScores(players: ScoutPlayer[]): Map<number, number | null> {
  const values = new Map<PositionGroup, number[][]>();
  const out = new Map<number, number | null>();
  for (const p of players) {
    const group = primaryPosition(p);
    if (group === null) {
      out.set(p.playerId, null);
      continue;
    }
    if (!values.has(group)) values.set(group, roleValues(group, players));
    const axes = axesFor(p, group, values.get(group)!);
    let weighted = 0;
    let weights = 0;
    axes.forEach((axis, index) => {
      if (axis.pct === null) return;
      const weight = ROLE_AXES[group][index].weight;
      weighted += axis.pct * weight;
      weights += weight;
    });
    out.set(p.playerId, weights > 0 ? Math.max(0, Math.min(100, weighted / weights)) : null);
  }
  return out;
}
