'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLiveScores, type LiveEntry } from '@/components/live-strip';
import { TeamBadge } from '@/components/team-badge';
import { Badge, Card, EmptyState, LiveDot, SectionHeader, Skeleton } from '@/components/ui';
import { clock, mapLabel, readableOn, safeColor, teamLabel } from '@/lib/format';

const REGION_LABEL: Record<number, string> = {
  1: 'Europe',
  2: 'South America',
  3: 'North America',
  4: 'Asia',
  6: 'Americas',
};

export function LiveBoard() {
  const { entries, error } = useLiveScores(12000);
  const [region, setRegion] = useState<number | null>(null);

  if (entries === null && !error) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  const all = entries ?? [];
  const regionsPresent = [...new Set(all.map((e) => e.regionId))].sort();
  const shown = region ? all.filter((e) => e.regionId === region) : all;

  const inPlay = shown.filter((e) => e.item2.matchPeriod !== 'WARM-UP');
  const warmup = shown.filter((e) => e.item2.matchPeriod === 'WARM-UP');

  if (all.length === 0) {
    return (
      <EmptyState
        title="No matches in progress"
        hint="Servers are quiet right now. This page refreshes automatically every 12 seconds."
        icon="📡"
      />
    );
  }

  return (
    <>
      {regionsPresent.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <FilterChip active={region === null} onClick={() => setRegion(null)}>
            All regions
            <Count n={all.length} />
          </FilterChip>
          {regionsPresent.map((r) => (
            <FilterChip key={r} active={region === r} onClick={() => setRegion(r)}>
              {REGION_LABEL[r] ?? `Region ${r}`}
              <Count n={all.filter((e) => e.regionId === r).length} />
            </FilterChip>
          ))}
        </div>
      )}

      {inPlay.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="In play" subtitle={`${inPlay.length} matches running`} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inPlay.map((e) => (
              <LiveMatchCard key={e.item1.id} entry={e} />
            ))}
          </div>
        </section>
      )}

      {warmup.length > 0 && (
        <section>
          <SectionHeader title="Warming up" subtitle="Kick-off imminent" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {warmup.map((e) => (
              <LiveMatchCard key={e.item1.id} entry={e} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular ml-1.5 text-[10px] opacity-60">{n}</span>;
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25'
          : 'border border-[var(--line)] text-chalk-500 hover:text-chalk-200'
      }`}
    >
      {children}
    </button>
  );
}

function LiveMatchCard({ entry }: { entry: LiveEntry }) {
  const { item1: match, item2: s } = entry;
  const warmup = s.matchPeriod === 'WARM-UP';
  const homeColor = safeColor(match.teamHome?.color, '#2563eb');
  const awayColor = safeColor(match.teamAway?.color, '#dc2626');

  const goalEvents = (s.matchEvents ?? []).filter(
    (e) => e.event === 'GOAL' || e.event === 'OWN GOAL',
  );

  return (
    <Card className="group relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }}
      />
      <Link href={`/matches/${match.id}`} className="block p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          {warmup ? (
            <Badge tone="muted">Warm-up</Badge>
          ) : (
            <Badge tone="live">
              <LiveDot />
              <span className="tabular">{clock(s.matchSeconds)}</span>
              <span className="opacity-70">{s.matchPeriod}</span>
            </Badge>
          )}
          <span className="truncate text-[10px] text-chalk-600">
            {mapLabel(s.mapName)}
          </span>
        </div>

        <Side
          team={match.teamHome}
          fallback={s.teamNameHome}
          goals={s.matchGoalsHome}
          lead={s.matchGoalsHome > s.matchGoalsAway}
          color={homeColor}
        />
        <div className="my-2.5 h-px bg-[var(--line)]" />
        <Side
          team={match.teamAway}
          fallback={s.teamNameAway}
          goals={s.matchGoalsAway}
          lead={s.matchGoalsAway > s.matchGoalsHome}
          color={awayColor}
        />

        <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] text-chalk-600">
          <span>
            {s.serverPlayerCount}/{s.matchFormat * 2} players
          </span>
          {match.tournament ? (
            <span className="max-w-[55%] truncate text-flare-500/80">
              {match.tournament.name}
            </span>
          ) : (
            <span>{s.matchFormat}v{s.matchFormat}</span>
          )}
        </div>

        {goalEvents.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {goalEvents.slice(-4).map((e, i) => (
              <span
                key={i}
                className="tabular rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-chalk-400"
              >
                ⚽ {Math.round(e.second / 60)}&apos;
              </span>
            ))}
          </div>
        )}
      </Link>
    </Card>
  );
}

function Side({
  team,
  fallback,
  goals,
  lead,
  color,
}: {
  team: LiveEntry['item1']['teamHome'];
  fallback: string;
  goals: number;
  lead: boolean;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} size="md" name={fallback} />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${
          lead ? 'font-semibold text-chalk-100' : 'font-medium text-chalk-300'
        }`}
      >
        {team ? teamLabel(team) : fallback}
      </span>
      <span
        className="tabular font-display text-2xl font-bold"
        style={{ color: lead ? readableOn(color) : 'var(--color-chalk-500)' }}
      >
        {goals}
      </span>
    </div>
  );
}
