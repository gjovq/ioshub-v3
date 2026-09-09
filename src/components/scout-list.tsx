'use client';

import { useMemo, useState } from 'react';
import { HexagonChart } from '@/components/hexagon';
import { Card } from '@/components/ui';
import { POSITION_COLORS, hexagonAxes, positionGroupOfStats, roleAxes, roleHeat, rolePercentiles } from '@/lib/scouting';
import { duration, num, pct } from '@/lib/format';
import type { PlayerStatistics } from '@/lib/types';

/**
 * Searchable scout list. One row per player; clicking a row expands the
 * hexagon profile and full stat breakdown inline.
 */
export function ScoutList({ players, initialPosition = 'all' }: { players: PlayerStatistics[]; initialPosition?: string }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = players.filter((p) => initialPosition === 'all' || positionGroupOfStats(p) === initialPosition).map((p) => ({ p, heat: roleHeat(p, players) }));
    // heat ranking, highest first
    base.sort((a, b) => b.heat - a.heat);
    if (!q) return base;
    return base.filter((r) => r.p.name.toLowerCase().includes(q));
  }, [players, query, initialPosition]);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 mb-3 bg-pitch-950/85 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-lg sm:px-3">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${players.length} scouted players…`}
            className="w-full rounded-lg border border-[var(--line)] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-chalk-100 placeholder:text-chalk-600 focus:border-turf-500/40 focus:outline-none"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-chalk-500">
          No players match “{query}”.
        </p>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {rows.map(({ p, heat }, i) => (
              <li key={p.playerId}>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === p.playerId ? null : p.playerId)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
                >
                  <span className="tabular w-8 shrink-0 text-right text-[11px] text-chalk-700">
                    {i + 1}
                  </span>
                  <GroupChip p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block max-w-[14rem] truncate text-sm font-semibold text-chalk-100">
                      {p.name}
                    </span>
                    <span className="block text-[10px] text-chalk-600">
                      {num(p.appearances)} apps · {pct(p.passCompletionPercentageAverage)} passing ·{' '}
                      {duration(p.secondsPlayed)}
                    </span>
                  </span>
                  <span className="tabular hidden shrink-0 text-right text-xs text-chalk-500 sm:block">
                    {p.rating > 0 ? p.rating.toFixed(2) : '–'}
                    <span className="block text-[9px] text-chalk-700">rating</span>
                  </span>
                  <HeatBadge heat={heat} />
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 shrink-0 text-chalk-600 transition-transform ${openId === p.playerId ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" />
                  </svg>
                </button>
                {openId === p.playerId && <ScoutDetail p={p} heat={heat} cohort={players} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ScoutDetail({ p, heat, cohort }: { p: PlayerStatistics; heat: number; cohort: PlayerStatistics[] }) {
  const axes = hexagonAxes(p);
  const group = positionGroupOfStats(p);
  const color = POSITION_COLORS[group];
  const apps = Math.max(1, p.appearances);
  const percentileAxes = rolePercentiles(p, cohort);
  const roleRaw = roleAxes(p);

  return (
    <div className="grid gap-4 border-t border-[var(--line)] bg-white/[0.015] px-4 py-4 sm:grid-cols-[220px_1fr]">
      <div>
        <div className="mx-auto max-w-[220px]">
          <HexagonChart axes={axes} color={color} size={220} />
        </div>
        <div className="mt-1 text-center">
          <span
            className="tabular rounded-md px-2.5 py-1 font-display text-2xl font-bold"
            style={{ background: `${color}1a`, color }}
            title="Scout heat: mean percentile across this role's six axes vs same-role players"
          >
            {heat}
          </span>
          <div className="label-xs mt-1">scout heat</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 self-center text-[13px] sm:grid-cols-3">
        {percentileAxes.map((a) => (
          <div key={a.label}>
            <div className="label-xs">{a.label}</div>
            <div className="tabular mt-0.5 font-semibold text-chalk-100" title={a.formula}>
              {a.percentile == null
                ? (roleRaw.find((x) => x.label === a.label)?.raw ?? 0).toFixed(2)
                : `${Math.round(a.percentile * 100)}%`}
              <span className="ml-1.5 text-[10px] font-normal text-chalk-600">{a.formula}</span>
            </div>
          </div>
        ))}
        <Detail label="Goals /match" value={(p.goals / apps).toFixed(2)} />
        <Detail label="Assists /match" value={(p.assists / apps).toFixed(2)} />
        <Detail label="Shots /match" value={(p.shots / apps).toFixed(2)} />
        <Detail label="Pass accuracy" value={pct(p.passCompletionPercentageAverage)} />
        <Detail label="Key passes /m" value={((p.keyPasses + p.chancesCreated) / apps).toFixed(2)} />
        <Detail label="Interceptions /m" value={(p.interceptions / apps).toFixed(2)} />
        <Detail label="Expected goals" value={p.expectedGoals > 0 ? p.expectedGoals.toFixed(2) : '–'} />
        <Detail label="Shots on target" value={pct(p.shotAccuracyPercentage)} />
        <Detail label="Win rate" value={pct(p.winPercentage)} />
        <Detail label="Cards" value={`${p.yellowCards}Y ${p.redCards}R`} />
        <Detail label="Distance /m" value={`${(p.distanceCoveredAverage / 1000).toFixed(2)} km`} />
        <Detail label="Rating" value={p.rating > 0 ? p.rating.toFixed(2) : '–'} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="tabular mt-0.5 font-semibold text-chalk-100">{value}</div>
    </div>
  );
}

function GroupChip({ p }: { p: PlayerStatistics }) {
  const group = positionGroupOfStats(p);
  const color = POSITION_COLORS[group];
  return (
    <span
      className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md font-display text-[10px] font-bold"
      style={{ background: `${color}26`, color }}
    >
      {group}
    </span>
  );
}

function HeatBadge({ heat }: { heat: number }) {
  const tone =
    heat >= 70
      ? 'bg-turf-500/20 text-turf-300'
      : heat >= 45
        ? 'bg-flare-500/15 text-flare-400'
        : 'bg-white/[0.06] text-chalk-400';
  return (
    <span className={`tabular w-10 shrink-0 rounded-md px-1 py-1 text-center text-xs font-bold ${tone}`}>
      {heat}
    </span>
  );
}
