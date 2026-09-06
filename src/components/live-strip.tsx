'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TeamBadge } from '@/components/team-badge';
import { Badge, LiveDot } from '@/components/ui';
import { clock, mapLabel, teamLabel } from '@/lib/format';
import type { LiveScoreEntry } from '@/lib/types';

export type LiveEntry = LiveScoreEntry & { regionId: number };

export function useLiveScores(pollMs = 15000, region?: number) {
  const [entries, setEntries] = useState<LiveEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = region ? `/api/live?region=${region}` : '/api/live';

    const load = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive) {
          setEntries(data.entries ?? []);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };

    load();
    const id = setInterval(load, pollMs);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pollMs, region]);

  return { entries, error };
}

/** Horizontal ticker used on the homepage. Renders nothing when nothing is live. */
export function LiveStrip() {
  const { entries } = useLiveScores(15000);
  if (!entries || entries.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LiveDot />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-chalk-200">
            Live now
          </h2>
          <span className="rounded bg-red-500/12 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
            {entries.length}
          </span>
        </div>
        <Link
          href="/live"
          className="text-xs font-medium text-chalk-500 transition-colors hover:text-turf-400"
        >
          All live matches →
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.slice(0, 8).map((e) => (
          <LiveTile key={e.item1.id} entry={e} />
        ))}
      </div>
    </section>
  );
}

function LiveTile({ entry }: { entry: LiveEntry }) {
  const { item1: match, item2: state } = entry;
  const warmup = state.matchPeriod === 'WARM-UP';

  return (
    <Link
      href={`/matches/${match.id}`}
      className="surface group w-[260px] shrink-0 p-3.5 transition-all hover:border-[var(--line-strong)] hover:bg-white/[0.02]"
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge tone={warmup ? 'muted' : 'live'}>
          {!warmup && <LiveDot />}
          {warmup ? 'Warm-up' : `${state.matchPeriod} ${clock(state.matchSeconds)}`}
        </Badge>
        <span className="truncate text-[10px] text-chalk-600">
          {mapLabel(state.mapName)}
        </span>
      </div>
      <LiveSide
        team={match.teamHome}
        name={state.teamNameHome}
        goals={state.matchGoalsHome}
        lead={state.matchGoalsHome > state.matchGoalsAway}
      />
      <div className="mt-2" />
      <LiveSide
        team={match.teamAway}
        name={state.teamNameAway}
        goals={state.matchGoalsAway}
        lead={state.matchGoalsAway > state.matchGoalsHome}
      />
    </Link>
  );
}

function LiveSide({
  team,
  name,
  goals,
  lead,
}: {
  team: LiveScoreEntry['item1']['teamHome'];
  name: string;
  goals: number;
  lead: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge team={team} size="sm" />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          lead ? 'font-semibold text-chalk-100' : 'font-medium text-chalk-300'
        }`}
      >
        {team ? teamLabel(team) : name}
      </span>
      <span
        className={`tabular text-base font-bold ${lead ? 'text-turf-400' : 'text-chalk-300'}`}
      >
        {goals}
      </span>
    </div>
  );
}
