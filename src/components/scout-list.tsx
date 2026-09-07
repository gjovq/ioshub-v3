'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { HexagonChart } from '@/components/hexagon';
import { ScoutHeatmap } from '@/components/scout-heatmap';
import { Card } from '@/components/ui';
import {
  POSITION_COLORS, hexagonFor, heatScores, passAccuracy, primaryPosition,
  type PositionGroup, type ScoutPlayer,
} from '@/lib/scouting';
import { duration, num, pct } from '@/lib/format';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-turf-400';
const UNKNOWN_COLOR = '#94a3b8';
// Disclosure mirrors the product's heuristic weights in lib/scouting.ts.
const WEIGHT_DISCLOSURE: Record<PositionGroup, string> = {
  GK: 'Saves 30%, Save % 35%, Conceded 15%, Passing 10%, Catches 5%, Winning 5%.',
  DEF: 'Interceptions 30%, Tackles 25%, Conceded 15%, Passing 15%, Key passes 10%, Fouls 5%.',
  MID: 'Key passes 25%, Chances 20%, Assists 20%, Passing 20%, Interceptions 10%, Goals 5%.',
  ATT: 'Goals 35%, Conversion 20%, Shot accuracy 15%, Shots 10%, Assists 10%, Key passes 10%.',
};
const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const stat = (value: number | null | undefined, digits = 0) =>
  finite(value) && value >= 0 ? num(value, digits) : 'Unavailable';

/** Search and chips change visible rows only, never the supplied comparison cohort. */
export function ScoutList({ players, teamNames = {} }: {
  players: ScoutPlayer[];
  /** Current team labels keyed by player ID, supplied by the page if available. */
  teamNames?: Record<number, string>;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [posFilter, setPosFilter] = useState<PositionGroup | 'all' | 'unknown'>('all');
  const heats = useMemo(() => heatScores(players), [players]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => posFilter === 'all' || (primaryPosition(p) ?? 'unknown') === posFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({ p, heat: heats.get(p.playerId) ?? null }))
      .sort((a, b) => {
        if (a.heat === null && b.heat !== null) return 1;
        if (b.heat === null && a.heat !== null) return -1;
        return (b.heat ?? 0) - (a.heat ?? 0) || a.p.name.localeCompare(b.p.name) || a.p.playerId - b.p.playerId;
      });
  }, [players, query, posFilter, heats]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * 50, currentPage * 50);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 mb-3 bg-pitch-950/95 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-lg sm:px-3">
        <label htmlFor={`${id}-search`} className="mb-1.5 block text-xs font-semibold text-chalk-300">Search scouted players</label>
        <input id={`${id}-search`} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder={`Search ${num(players.length)} players by name…`}
          className={`w-full rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-sm text-chalk-100 placeholder:text-chalk-600 ${FOCUS}`} />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by most-played recorded position group">
          {(['all', 'GK', 'DEF', 'MID', 'ATT', 'unknown'] as const).map((group) => (
            <button key={group} type="button" aria-pressed={posFilter === group} onClick={() => { setPosFilter(group); setPage(1); }}
              className={`min-h-9 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${FOCUS} ${posFilter === group ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25' : 'text-chalk-400 hover:bg-white/[0.04] hover:text-chalk-200'}`}>
              {group === 'all' ? 'All positions' : group === 'unknown' ? 'Unknown' : group}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-chalk-500">Chips use only the most-played recorded group from all-time position history. Search and chips do not change comparison samples.</p>
        <p className="mt-1 text-xs text-chalk-400" aria-live="polite" aria-atomic="true">{num(rows.length)} of {num(players.length)} eligible players match · page {currentPage} of {pageCount} · ordered by scout heat, unavailable last</p>
      </div>

      {rows.length === 0 ? <p className="py-10 text-center text-sm text-chalk-500">No players match {query ? `“${query}”` : 'these filters'}.</p> : (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {visibleRows.map(({ p, heat }) => {
              const expanded = openId === p.playerId;
              const panelId = `${id}-profile-${p.playerId}`;
              return (
                <li key={p.playerId}>
                  <button type="button" aria-expanded={expanded} aria-controls={panelId}
                    onClick={() => setOpenId(expanded ? null : p.playerId)}
                    className={`flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-white/[0.025] sm:gap-3 ${FOCUS}`}>
                    <GroupChip p={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-chalk-100">{p.name}</span>
                      {teamNames[p.playerId] && <span className="block break-words text-[11px] text-chalk-400">Current team: {teamNames[p.playerId]}</span>}
                      <span className="mt-0.5 block text-[11px] text-chalk-500">
                        {stat(p.appearances)} apps · {pct(passAccuracy(p))} passing · {finite(p.secondsPlayed) && p.secondsPlayed >= 0 ? duration(p.secondsPlayed) : 'Time unavailable'}
                      </span>
                    </span>
                    <HeatBadge heat={heat} />
                    <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-chalk-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" /></svg>
                  </button>
                  <div id={panelId} hidden={!expanded}>
                    {expanded && <ScoutDetail p={p} heat={heat} cohort={players} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {pageCount > 1 && <nav aria-label="Scouting results pages" className="mt-4 flex items-center justify-center gap-4 text-sm">
        <button type="button" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); setOpenId(null); }}
          className={`rounded border border-[var(--line)] px-3 py-2 disabled:opacity-40 ${FOCUS}`}>Previous</button>
        <span>Page {currentPage} of {pageCount}</span>
        <button type="button" disabled={currentPage >= pageCount} onClick={() => { setPage(currentPage + 1); setOpenId(null); }}
          className={`rounded border border-[var(--line)] px-3 py-2 disabled:opacity-40 ${FOCUS}`}>Next</button>
      </nav>}
    </div>
  );
}

function ScoutDetail({ p, heat, cohort }: { p: ScoutPlayer; heat: number | null; cohort: ScoutPlayer[] }) {
  const { axes, peerCount, sampleCounts } = useMemo(() => {
    const group = primaryPosition(p);
    const axes = hexagonFor(p, cohort);
    const peers = group === null ? [] : cohort.filter((peer) => primaryPosition(peer) === group);
    // Empty comparison input extracts the exact same raw axes without recomputing rankings.
    const peerAxes = peers.map((peer) => hexagonFor(peer, []));
    return { axes, peerCount: peers.length, sampleCounts: axes.map((_, i) => peerAxes.filter((values) => finite(values[i]?.raw)).length) };
  }, [p, cohort]);
  const group = primaryPosition(p);
  const color = group ? POSITION_COLORS[group] : UNKNOWN_COLOR;
  const supported = axes.filter((axis) => finite(axis.pct)).length;
  const missing = axes.filter((axis) => !finite(axis.pct)).map((axis) => axis.label);
  const winRate = finite(p.winPercentage) && p.winPercentage >= 0 && p.winPercentage <= 1 && p.appearances > 0 ? pct(p.winPercentage) : 'Unavailable';
  const overall = [
    ['Appearances', stat(p.appearances)], ['Minutes played', finite(p.secondsPlayed) ? stat(p.secondsPlayed / 60) : 'Unavailable'],
    ['Goals (total)', stat(p.goals)], ['Assists (total)', stat(p.assists)],
    ['Pass accuracy', passAccuracy(p) === null ? 'Unavailable' : pct(passAccuracy(p))],
    ['Win rate', winRate], ['Yellow / red cards', `${stat(p.yellowCards)} / ${stat(p.redCards)}`],
    ['Distance / appearance', finite(p.distanceCoveredAverage) && p.distanceCoveredAverage >= 0 && p.appearances > 0 ? `${num(p.distanceCoveredAverage / 1000, 2)} km` : 'Unavailable'],
    ['Rating', finite(p.rating) && p.rating > 0 ? num(p.rating, 2) : 'Unavailable'],
  ];

  return (
    <section aria-label={`${p.name} scouting profile`} className="space-y-5 border-t border-[var(--line)] bg-white/[0.015] p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-chalk-100">Role profile</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-chalk-400">
            {p.scoutPosition ? <>Most-played recorded role: <strong className="text-chalk-200">{p.scoutPosition.name}</strong> · {group} · {pct(p.scoutPosition.share)} of recorded position time ({duration(p.scoutPosition.secondsPlayed)}). Based on <strong>all-time position history</strong>, not necessarily the selected statistics period.</> : 'Recorded position unavailable. Group, role percentiles and heat cannot be assigned from aggregate statistics alone.'}
          </p>
        </div>
        <Link href={`/players/${p.playerId}`} className={`rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold text-turf-400 hover:bg-turf-500/10 ${FOCUS}`}>View player profile →</Link>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          {axes.length > 0 ? <div className="mx-auto max-w-sm"><HexagonChart axes={axes.map((axis) => ({ label: axis.label, value: finite(axis.pct) ? axis.pct / 100 : null }))} color={color} label={`${p.name}: ${group} axis percentiles`} /></div> : <p className="py-6 text-center text-sm text-chalk-500">Radar unavailable — no recorded role.</p>}
          <div className="text-center">
            <span className="tabular font-display text-3xl font-bold" style={{ color }}>{finite(heat) ? num(heat, 1) : 'Unavailable'}</span>
            <p className="mt-1 text-xs font-semibold text-chalk-300">Scout heat {finite(heat) ? '/ 100' : ''}</p>
            <p className="mt-1 text-[11px] text-chalk-500">Weighted heuristic score · not a percentile or global rank</p>
          </div>
          <ScoutHeatmap p={p} axes={axes} />
        </div>

        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-chalk-200">Six role axes</h4>
          <p className="mt-1 text-xs leading-relaxed text-chalk-500">{group ? `${num(peerCount)} ${group} players in the loaded comparison cohort (including this player). Each axis requires at least 5 finite observations; its valid sample is shown below.` : 'No same-group comparison is available without a recorded role.'}</p>
          <div className="mt-3 space-y-3">
            {axes.map((axis, i) => {
              const ranked = finite(axis.pct);
              const reason = !finite(axis.raw) ? 'Missing or invalid metric / denominator' : sampleCounts[i] < 5 ? 'Fewer than 5 valid same-group observations' : 'Comparison unavailable';
              return (
                <div key={axis.label} className="rounded-md border border-[var(--line)] p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-chalk-300">{axis.label}{axis.unit === 'rate' ? ' / appearance' : ''}{axis.lowerIsBetter ? ' ↓' : ''}</span>
                    <span className="tabular font-semibold text-chalk-100">{finite(axis.raw) ? axis.unit === 'percent' ? pct(axis.raw) : num(axis.raw, 2) : 'Unavailable'}</span>
                  </div>
                  {ranked ? <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-label={`${axis.label} same-group percentile`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={axis.pct!} aria-valuetext={`${num(axis.pct, 1)} percentile; ${sampleCounts[i]} valid observations`}>
                      <div className="h-full rounded-full" style={{ width: `${axis.pct}%`, backgroundColor: color }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-chalk-400">{num(axis.pct, 1)} percentile · n = {num(sampleCounts[i])}{axis.lowerIsBetter ? ' · lower raw value is better' : ''}</p>
                  </> : <p className="mt-2 text-[11px] leading-relaxed text-chalk-500">Percentile unavailable · {reason} · n = {num(sampleCounts[i])}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-chalk-500">Percentiles use same-group midranks (ties share a rank), not comparisons with every position. Rate axes are per appearance, not per 90 minutes. Radar gaps mean unavailable, never zero.</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] p-3 text-xs leading-relaxed text-chalk-400">
        <h4 className="font-semibold text-chalk-200">How scout heat is calculated</h4>
        <p className="mt-1">A 0–100 weighted average of supported same-group axis percentiles using product-selected heuristic weights, not a calibrated performance rating or a top-percent ranking. Scores across different role groups are not directly comparable.</p>
        {group && <p className="mt-1">Base weights: {WEIGHT_DISCLOSURE[group]}</p>}
        <p className="mt-1">{supported}/6 axes supported. {missing.length > 0 ? `Omitted: ${missing.join(', ')}. Available weights are renormalized; missing metrics are not filled in.` : group ? 'All six axes are available; no weight renormalization needed.' : 'No recorded role; no role axes or weights can be selected.'}</p>
        {!finite(heat) && <p className="mt-1">Heat unavailable: {group ? 'no supported axes. Metrics must be valid and each comparison needs at least five finite same-group observations.' : 'the recorded most-played role is unknown.'}</p>}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-chalk-200">Overall statistics <span className="font-normal text-chalk-500">· unranked</span></h4>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {overall.map(([label, value]) => <div key={label}><dt className="text-[11px] text-chalk-500">{label}</dt><dd className="tabular mt-0.5 break-words text-sm font-semibold text-chalk-200">{value}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}

function GroupChip({ p }: { p: ScoutPlayer }) {
  const group = primaryPosition(p);
  const color = group ? POSITION_COLORS[group] : UNKNOWN_COLOR;
  return <span className="flex min-h-8 w-14 shrink-0 items-center justify-center rounded-md text-[10px] font-bold" style={{ background: `${color}26`, color }} title={group ? `Most-played recorded group: ${group} (all-time history)` : 'No recorded position available'}>{group ?? 'Unknown'}</span>;
}

function HeatBadge({ heat }: { heat: number | null }) {
  const available = finite(heat);
  const tone = available && heat >= 80 ? 'bg-turf-500/20 text-turf-300' : available && heat >= 55 ? 'bg-flare-500/15 text-flare-400' : 'bg-white/[0.06] text-chalk-400';
  return <span className={`tabular w-16 shrink-0 rounded-md px-1 py-1.5 text-center text-xs font-bold ${tone}`} title={available ? 'Scout heat: weighted heuristic score out of 100, not a percentile or global rank' : 'Scout heat unavailable: expand for details'}>
    {available ? num(heat, 1) : 'N/A'}<span className="block text-[9px] font-normal">{available ? 'heat / 100' : 'unavailable'}</span>
  </span>;
}
