'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLiveScores, type LiveEntry } from '@/components/live-strip';
import { TeamBadge } from '@/components/team-badge';
import { Badge, Card, EmptyState, LiveDot, SectionHeader, Skeleton } from '@/components/ui';
import { clock, flagEmoji, mapLabel, readableOn, safeColor, teamLabel } from '@/lib/format';

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
  const flag = flagEmoji(match.server?.country?.code);

  return (
    <Card className="group relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }}
      />
      <Link href={`/matches/${match.id}`} className="block p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {warmup ? (
            <Badge tone="muted">Warm-up</Badge>
          ) : (
            <Badge tone="live">
              <LiveDot />
              <span className="tabular">{clock(s.matchSeconds)}</span>
              <span className="opacity-70">
                {s.matchPeriod.replace(' HALF', '')}
              </span>
            </Badge>
          )}
          <span className="truncate text-[10px] text-chalk-600">
            {flag} {s.matchFormat}v{s.matchFormat}
          </span>
        </div>

        {/* compact one-row scoreline: CON 1 – 1 Dons */}
        <div className="flex items-center justify-between gap-2">
          <SideName
            team={match.teamHome}
            fallback={s.teamNameHome}
            lead={s.matchGoalsHome > s.matchGoalsAway}
            color={homeColor}
            align="left"
          />
          <span
            className="tabular shrink-0 font-display text-xl font-bold"
            style={{ color: readableOn(homeColor) }}
          >
            {s.matchGoalsHome}
          </span>
          <span className="shrink-0 text-xs text-chalk-700">–</span>
          <span
            className="tabular shrink-0 font-display text-xl font-bold"
            style={{ color: readableOn(awayColor) }}
          >
            {s.matchGoalsAway}
          </span>
          <SideName
            team={match.teamAway}
            fallback={s.teamNameAway}
            lead={s.matchGoalsAway > s.matchGoalsHome}
            color={awayColor}
            align="right"
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line)] pt-2.5 text-[10px] text-chalk-600">
          <span>
            👥 {s.serverPlayerCount}/{s.matchFormat * 2} · {mapLabel(s.mapName)}
          </span>
        </div>

      </Link>
    </Card>
  );
}

function SideName({
  team,
  fallback,
  lead,
  align,
}: {
  team: LiveEntry['item1']['teamHome'];
  fallback: string;
  lead: boolean;
  color: string;
  align: 'left' | 'right';
}) {
  const name = team ? teamLabel(team) : fallback;
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-1.5 ${
        align === 'right' ? 'flex-row-reverse' : ''
      }`}
    >
      <TeamBadge team={team} size="xs" name={fallback} />
      <span
        className={`min-w-0 truncate text-[13px] ${
          lead ? 'font-semibold text-chalk-100' : 'font-medium text-chalk-400'
        }`}
      >
        {name}
      </span>
    </span>
  );
}
