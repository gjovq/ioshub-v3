import { Suspense } from 'react';
import Link from 'next/link';
import { buildQuery, Pills } from '@/components/controls';
import { TeamBadge } from '@/components/team-badge';
import { Card, SectionHeader, Skeleton } from '@/components/ui';
import { getPlayerStatistics, getRegions, getTeamStatistics, safe } from '@/lib/api';
import { TIME_PERIODS } from '@/lib/enums';
import { compact, num, pct } from '@/lib/format';
import type { PlayerStatistics, StatFilters, TeamStatistics } from '@/lib/types';

export const revalidate = 600;
export const metadata = { title: 'Leaderboards' };

type SP = Promise<Record<string, string | string[] | undefined>>;

type Row = {
  id: number;
  href: string;
  label: string;
  meta: string;
  value: string;
  badgeUrl?: string | null;
};

const PLAYER_BOARDS: {
  sort: string;
  title: string;
  unit: string;
  pick: (p: PlayerStatistics) => string;
}[] = [
  { sort: 'Goals', title: 'Top scorers', unit: 'goals', pick: (p) => num(p.goals) },
  { sort: 'Assists', title: 'Most assists', unit: 'assists', pick: (p) => num(p.assists) },
  {
    sort: 'GoalsAverage',
    title: 'Goals per match',
    unit: 'per match',
    pick: (p) => p.goalsAverage.toFixed(2),
  },
  { sort: 'Rating', title: 'Highest rated', unit: 'rating', pick: (p) => p.rating.toFixed(2) },
  {
    sort: 'Interceptions',
    title: 'Most interceptions',
    unit: 'won',
    pick: (p) => compact(p.interceptions),
  },
  { sort: 'KeeperSaves', title: 'Most saves', unit: 'saves', pick: (p) => compact(p.keeperSaves) },
  {
    sort: 'PassCompletionPercentageAverage',
    title: 'Best passers',
    unit: 'accuracy',
    pick: (p) => pct(p.passCompletionPercentageAverage),
  },
  {
    sort: 'WinPercentage',
    title: 'Best win rate',
    unit: 'wins',
    pick: (p) => pct(p.winPercentage),
  },
];

const TEAM_BOARDS: {
  sort: string;
  title: string;
  unit: string;
  pick: (t: TeamStatistics) => string;
}[] = [
  { sort: 'Points', title: 'Most points', unit: 'pts', pick: (t) => num(t.points) },
  { sort: 'Goals', title: 'Most goals', unit: 'goals', pick: (t) => num(t.goals) },
  {
    sort: 'WinPercentage',
    title: 'Best win rate',
    unit: 'wins',
    pick: (t) => pct(t.winPercentage),
  },
];

export default async function LeadersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const period = Number(str('period') ?? 31);
  const region = str('region') ? Number(str('region')) : undefined;
  const minApps = Number(str('minApps') ?? 10);

  const filters: StatFilters = {
    timePeriod: Number.isFinite(period) ? period : 31,
    regionId: region ?? null,
    minimumAppearances: minApps,
  };

  const regions = await safe(getRegions());

  const current = { period, region, minApps };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/leaders', current, over, { period: 31, minApps: 10 });

  const periodLabel = TIME_PERIODS.find((t) => t.value === period)?.label ?? 'All time';
  // Every board is a separate upstream query and all-time aggregates are slow,
  // so each streams in independently rather than blocking the whole page.
  const key = `${period}-${region ?? 'all'}-${minApps}`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Leaderboards
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          Who is on top right now · {periodLabel.toLowerCase()}, minimum {minApps}{' '}
          appearances
        </p>
      </header>

      <div className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Pills
          label="Period"
          active={period}
          options={TIME_PERIODS.map((t) => ({ value: t.value, label: t.label }))}
          hrefFor={(v) => qs({ period: v })}
        />
        <Pills
          label="Region"
          active={region}
          options={[
            { value: undefined, label: 'All' },
            ...(regions ?? [])
              .filter((r) => r.matchCount > 0)
              .map((r) => ({ value: r.regionId, label: r.regionCode })),
          ]}
          hrefFor={(v) => qs({ region: v })}
        />
        <Pills
          label="Min apps"
          active={minApps}
          options={[
            { value: 1, label: '1+' },
            { value: 10, label: '10+' },
            { value: 30, label: '30+' },
            { value: 100, label: '100+' },
          ]}
          hrefFor={(v) => qs({ minApps: v })}
        />
      </div>

      {period === 0 && (
        <p className="mb-5 rounded-lg border border-flare-500/15 bg-flare-500/[0.05] px-3.5 py-2.5 text-xs text-flare-400/90">
          All-time aggregates are computed live by the IOSoccer API and can take
          a while — boards appear as each one resolves.
        </p>
      )}

      <SectionHeader title="Players" subtitle="Top 10 in each category" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAYER_BOARDS.map((b) => (
          <Suspense key={`${b.sort}-${key}`} fallback={<BoardSkeleton title={b.title} />}>
            <PlayerBoard board={b} filters={filters} />
          </Suspense>
        ))}
      </div>

      <div className="mt-10">
        <SectionHeader title="Teams" subtitle="Best performing sides" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEAM_BOARDS.map((b) => (
            <Suspense
              key={`t-${b.sort}-${key}`}
              fallback={<BoardSkeleton title={b.title} />}
            >
              <TeamBoard board={b} filters={filters} />
            </Suspense>
          ))}
        </div>
      </div>
    </div>
  );
}

async function PlayerBoard({
  board,
  filters,
}: {
  board: (typeof PLAYER_BOARDS)[number];
  filters: StatFilters;
}) {
  const page = await safe(
    getPlayerStatistics({
      pageSize: 10,
      sortBy: board.sort,
      sortOrder: 'DESC',
      filters,
    }),
  );

  const rows: Row[] = (page?.items ?? []).map((p) => ({
    id: p.playerId,
    href: `/players/${p.playerId}`,
    label: p.name,
    meta: `${p.appearances} apps`,
    value: board.pick(p),
  }));

  return <Board title={board.title} unit={board.unit} rows={rows} />;
}

async function TeamBoard({
  board,
  filters,
}: {
  board: (typeof TEAM_BOARDS)[number];
  filters: StatFilters;
}) {
  const page = await safe(
    getTeamStatistics({
      pageSize: 10,
      sortBy: board.sort,
      sortOrder: 'DESC',
      filters: {
        timePeriod: filters.timePeriod,
        regionId: filters.regionId,
        minimumMatches: 5,
      },
    }),
  );

  const rows: Row[] = (page?.items ?? []).map((t) => ({
    id: t.teamId,
    href: `/teams/${t.teamId}`,
    label: t.teamName,
    meta: `${t.appearances} matches`,
    value: board.pick(t),
    badgeUrl: t.badgeImageUrl,
  }));

  return <Board title={board.title} unit={board.unit} rows={rows} />;
}

function Board({ title, unit, rows }: { title: string; unit: string; rows: Row[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-[var(--line)] px-4 py-3">
        <h3 className="font-display text-sm font-bold text-chalk-100">{title}</h3>
        <span className="label-xs">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-chalk-600">
          No data for these filters
        </p>
      ) : (
        <ol className="divide-y divide-[var(--line)]">
          {rows.map((r, i) => (
            <li key={`${r.id}-${i}`}>
              <Link
                href={r.href}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className={`tabular flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                    i === 0
                      ? 'bg-flare-500/15 text-flare-400'
                      : i < 3
                        ? 'bg-white/[0.07] text-chalk-300'
                        : 'text-chalk-600'
                  }`}
                >
                  {i + 1}
                </span>
                {r.badgeUrl !== undefined && (
                  <TeamBadge url={r.badgeUrl} name={r.label} size="xs" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-chalk-200">
                    {r.label}
                  </span>
                  <span className="block text-[10px] text-chalk-600">{r.meta}</span>
                </span>
                <span className="tabular shrink-0 text-sm font-bold text-chalk-100">
                  {r.value}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function BoardSkeleton({ title }: { title: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-[var(--line)] px-4 py-3">
        <h3 className="font-display text-sm font-bold text-chalk-400">{title}</h3>
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-chalk-700 border-t-turf-500" />
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </Card>
  );
}
