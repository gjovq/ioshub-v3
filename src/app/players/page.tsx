import Link from 'next/link';
import { buildQuery, Pagination, Pills, SortableTh } from '@/components/controls';
import { Card, EmptyState, ErrorNote, FormRun } from '@/components/ui';
import { getPlayerStatistics, getRegions, safe } from '@/lib/api';
import { TIME_PERIODS } from '@/lib/enums';
import { compact, duration, num, pct } from '@/lib/format';
import type { StatFilters } from '@/lib/types';

export const revalidate = 300;
export const metadata = { title: 'Player statistics' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 30;
const DEFAULTS = { page: 1, sort: 'Goals', order: 'DESC', period: 0, minApps: 10 };

const COLUMNS = [
  { field: 'Appearances', label: 'Apps', title: 'Appearances' },
  { field: 'Goals', label: 'G', title: 'Goals' },
  { field: 'Assists', label: 'A', title: 'Assists' },
  { field: 'GoalsAverage', label: 'G/M', title: 'Goals per match' },
  { field: 'Shots', label: 'Sh', title: 'Shots' },
  { field: 'PassesCompleted', label: 'Pass', title: 'Passes completed' },
  { field: 'PassCompletionPercentageAverage', label: 'Pass%', title: 'Pass completion' },
  { field: 'Interceptions', label: 'Int', title: 'Interceptions' },
  { field: 'KeeperSaves', label: 'Sv', title: 'Keeper saves' },
  { field: 'WinPercentage', label: 'Win%', title: 'Win percentage' },
] as const;

export default async function PlayersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const page = Math.max(1, Number(str('page')) || 1);
  const sort = str('sort') ?? DEFAULTS.sort;
  const order = (str('order') === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
  const period = Number(str('period') ?? DEFAULTS.period);
  const region = str('region') ? Number(str('region')) : undefined;
  const minApps = Number(str('minApps') ?? DEFAULTS.minApps);
  const q = str('q')?.trim();

  const filters: StatFilters = {
    timePeriod: Number.isFinite(period) ? period : 0,
    regionId: region ?? null,
    minimumAppearances: Number.isFinite(minApps) && minApps > 0 ? minApps : null,
    playerName: q || null,
  };

  const [data, regions] = await Promise.all([
    safe(getPlayerStatistics({ page, pageSize: PAGE_SIZE, sortBy: sort, sortOrder: order, filters })),
    safe(getRegions()),
  ]);

  const current = { page, sort, order, period, region, minApps, q };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/players', current, over, DEFAULTS);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Player statistics
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          {data
            ? `${data.totalItems.toLocaleString('en-GB')} players match these filters`
            : 'Sort and filter every ranked player'}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Pills
          label="Period"
          active={period}
          options={TIME_PERIODS.map((t) => ({ value: t.value, label: t.label }))}
          hrefFor={(v) => qs({ period: v, page: 1 })}
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
          hrefFor={(v) => qs({ region: v, page: 1 })}
        />
        <Pills
          label="Min apps"
          active={minApps}
          options={[
            { value: 1, label: '1+' },
            { value: 10, label: '10+' },
            { value: 50, label: '50+' },
            { value: 200, label: '200+' },
          ]}
          hrefFor={(v) => qs({ minApps: v, page: 1 })}
        />
      </div>

      {!data ? (
        <ErrorNote message="Could not load player statistics." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No players match these filters" hint="Try a shorter period or a lower appearance threshold." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="label-xs w-12 px-3 py-2.5 text-left">#</th>
                  <th className="label-xs px-3 py-2.5 text-left">Player</th>
                  <SortableTh
                    label="Rating"
                    field="Rating"
                    activeField={sort}
                    activeOrder={order}
                    hrefFor={(f, o) => qs({ sort: f, order: o, page: 1 })}
                  />
                  {COLUMNS.map((c) => (
                    <SortableTh
                      key={c.field}
                      label={c.label}
                      title={c.title}
                      field={c.field}
                      activeField={sort}
                      activeOrder={order}
                      hrefFor={(f, o) => qs({ sort: f, order: o, page: 1 })}
                    />
                  ))}
                  <th className="label-xs px-3 py-2.5 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {data.items.map((p, i) => {
                  const rank = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr key={p.playerId} className="transition-colors hover:bg-white/[0.025]">
                      <td className="tabular px-3 py-2.5 text-xs text-chalk-600">{rank}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/players/${p.playerId}`}
                          className="block max-w-[13rem] truncate font-medium text-chalk-100 transition-colors hover:text-turf-400"
                        >
                          {p.name}
                        </Link>
                        <div className="text-[10px] text-chalk-600">
                          {duration(p.secondsPlayed)} played
                        </div>
                      </td>
                      <Cell>
                        <RatingChip value={p.rating} />
                      </Cell>
                      <Cell>{num(p.appearances)}</Cell>
                      <Cell strong>{num(p.goals)}</Cell>
                      <Cell>{num(p.assists)}</Cell>
                      <Cell dim>{p.goalsAverage.toFixed(2)}</Cell>
                      <Cell dim>{compact(p.shots)}</Cell>
                      <Cell dim>{compact(p.passesCompleted)}</Cell>
                      <Cell dim>{pct(p.passCompletionPercentageAverage)}</Cell>
                      <Cell dim>{compact(p.interceptions)}</Cell>
                      <Cell dim>{p.keeperSaves ? compact(p.keeperSaves) : '–'}</Cell>
                      <Cell dim>{pct(p.winPercentage)}</Cell>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          <FormRun form={p.form} size="sm" max={5} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && (
        <Pagination
          page={data.page}
          totalPages={Math.min(data.totalPages, 200)}
          hrefFor={(p) => qs({ page: p })}
        />
      )}
    </div>
  );
}

function Cell({
  children,
  strong,
  dim,
}: {
  children: React.ReactNode;
  strong?: boolean;
  dim?: boolean;
}) {
  return (
    <td
      className={`tabular px-2.5 py-2.5 text-center ${
        strong ? 'font-bold text-chalk-100' : dim ? 'text-chalk-500' : 'text-chalk-300'
      }`}
    >
      {children}
    </td>
  );
}

export function RatingChip({ value }: { value: number | null }) {
  if (!value) return <span className="text-chalk-700">–</span>;
  const tone =
    value >= 8.5
      ? 'bg-turf-500/15 text-turf-400'
      : value >= 7
        ? 'bg-flare-500/12 text-flare-400'
        : value >= 5
          ? 'bg-white/[0.06] text-chalk-300'
          : 'bg-white/[0.04] text-chalk-500';
  return (
    <span className={`tabular rounded px-1.5 py-0.5 text-xs font-bold ${tone}`}>
      {value.toFixed(2)}
    </span>
  );
}
