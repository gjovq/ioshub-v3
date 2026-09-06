import Link from 'next/link';
import { buildQuery, Pagination, Pills, SortableTh } from '@/components/controls';
import { TeamBadge } from '@/components/team-badge';
import { Card, EmptyState, ErrorNote, FormRun } from '@/components/ui';
import { getRegions, getTeamStatistics, safe } from '@/lib/api';
import { TIME_PERIODS } from '@/lib/enums';
import { compact, fmtDate, num, pct } from '@/lib/format';
import type { StatFilters } from '@/lib/types';

export const revalidate = 300;
export const metadata = { title: 'Teams' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 30;
const DEFAULTS = { page: 1, sort: 'Points', order: 'DESC', period: 0, minMatches: 10 };

export default async function TeamsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const page = Math.max(1, Number(str('page')) || 1);
  const sort = str('sort') ?? DEFAULTS.sort;
  const order = (str('order') === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
  const period = Number(str('period') ?? DEFAULTS.period);
  const region = str('region') ? Number(str('region')) : undefined;
  const minMatches = Number(str('minMatches') ?? DEFAULTS.minMatches);
  const teamType = str('teamType') ? Number(str('teamType')) : undefined;

  const filters: StatFilters = {
    timePeriod: Number.isFinite(period) ? period : 0,
    regionId: region ?? null,
    minimumMatches: Number.isFinite(minMatches) && minMatches > 0 ? minMatches : null,
    teamType: teamType ?? null,
  };

  const [data, regions] = await Promise.all([
    safe(getTeamStatistics({ page, pageSize: PAGE_SIZE, sortBy: sort, sortOrder: order, filters })),
    safe(getRegions()),
  ]);

  const current = { page, sort, order, period, region, minMatches, teamType };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/teams', current, over, DEFAULTS);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Teams
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          {data
            ? `${data.totalItems.toLocaleString('en-GB')} teams match these filters`
            : 'Aggregate team performance across all competitions'}
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
              .filter((r) => r.teamCount > 0)
              .map((r) => ({ value: r.regionId, label: r.regionCode })),
          ]}
          hrefFor={(v) => qs({ region: v, page: 1 })}
        />
        <Pills
          label="Type"
          active={teamType}
          options={[
            { value: undefined, label: 'All' },
            { value: 1, label: 'Club' },
            { value: 2, label: 'National' },
            { value: 3, label: 'Mix' },
          ]}
          hrefFor={(v) => qs({ teamType: v, page: 1 })}
        />
        <Pills
          label="Min matches"
          active={minMatches}
          options={[
            { value: 1, label: '1+' },
            { value: 10, label: '10+' },
            { value: 50, label: '50+' },
            { value: 200, label: '200+' },
          ]}
          hrefFor={(v) => qs({ minMatches: v, page: 1 })}
        />
      </div>

      {!data ? (
        <ErrorNote message="Could not load team statistics." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No teams match these filters" hint="Try a wider period or lower threshold." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="label-xs w-12 px-3 py-2.5 text-left">#</th>
                  <th className="label-xs px-3 py-2.5 text-left">Team</th>
                  {(
                    [
                      ['Appearances', 'P', 'Matches played'],
                      ['Wins', 'W', 'Wins'],
                      ['Points', 'Pts', 'Points'],
                      ['Goals', 'GF', 'Goals for'],
                      ['GoalsConceded', 'GA', 'Goals against'],
                      ['GoalDifference', 'GD', 'Goal difference'],
                      ['WinPercentage', 'Win%', 'Win percentage'],
                    ] as const
                  ).map(([field, label, title]) => (
                    <SortableTh
                      key={field}
                      field={field}
                      label={label}
                      title={title}
                      activeField={sort}
                      activeOrder={order}
                      hrefFor={(f, o) => qs({ sort: f, order: o, page: 1 })}
                    />
                  ))}
                  <th className="label-xs px-3 py-2.5 text-center">Pass%</th>
                  <th className="label-xs px-3 py-2.5 text-center">Form</th>
                  <th className="label-xs px-3 py-2.5 text-right">Last match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {data.items.map((t, i) => (
                  <tr key={t.teamId} className="transition-colors hover:bg-white/[0.025]">
                    <td className="tabular px-3 py-2.5 text-xs text-chalk-600">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/teams/${t.teamId}`}
                        className="flex items-center gap-2.5 transition-colors hover:text-turf-400"
                      >
                        <TeamBadge url={t.badgeImageUrl} name={t.teamName} size="sm" />
                        <span className="max-w-[13rem] truncate font-medium text-chalk-100">
                          {t.teamName}
                        </span>
                      </Link>
                    </td>
                    <Cell>{num(t.appearances)}</Cell>
                    <Cell>{num(t.wins)}</Cell>
                    <Cell strong>{num(t.points)}</Cell>
                    <Cell>{compact(t.goals)}</Cell>
                    <Cell dim>{compact(t.goalsConceded)}</Cell>
                    <Cell dim={t.goalDifference === 0}>
                      <span
                        className={
                          t.goalDifference > 0
                            ? 'text-turf-400'
                            : t.goalDifference < 0
                              ? 'text-red-400/80'
                              : ''
                        }
                      >
                        {t.goalDifference > 0 ? '+' : ''}
                        {num(t.goalDifference)}
                      </span>
                    </Cell>
                    <Cell dim>{pct(t.winPercentage)}</Cell>
                    <Cell dim>{pct(t.passCompletionPercentageAverage)}</Cell>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <FormRun form={t.form} size="sm" max={5} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-chalk-600">
                      {fmtDate(t.lastMatchDate)}
                    </td>
                  </tr>
                ))}
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
