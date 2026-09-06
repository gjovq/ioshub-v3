import { MatchRow } from '@/components/match-card';
import { buildQuery, Pagination, Pills, Tabs } from '@/components/controls';
import { Card, EmptyState, ErrorNote } from '@/components/ui';
import { getMatches, getRegions, safe } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import type { Match, MatchFilters } from '@/lib/types';

export const revalidate = 60;
export const metadata = { title: 'Matches' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 25;
const DEFAULTS = { view: 'results', page: 1 };

export default async function MatchesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const view = str('view') === 'upcoming' ? 'upcoming' : 'results';
  const page = Math.max(1, Number(str('page')) || 1);
  const region = str('region') ? Number(str('region')) : undefined;
  const type = str('type') !== undefined ? Number(str('type')) : undefined;
  const format = str('format') ? Number(str('format')) : undefined;

  const upcoming = view === 'upcoming';
  const filters: MatchFilters = {
    includePast: !upcoming,
    includeUpcoming: upcoming,
    regionId: region ?? null,
    matchType: Number.isFinite(type) ? type : null,
    matchFormat: format ?? null,
  };

  const [data, regions] = await Promise.all([
    safe(
      getMatches({
        page,
        pageSize: PAGE_SIZE,
        sortBy: 'KickOff',
        sortOrder: upcoming ? 'ASC' : 'DESC',
        filters,
      }),
    ),
    safe(getRegions()),
  ]);

  const current = { view, page, region, type, format };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/matches', current, over, DEFAULTS);

  const grouped = groupByDay(data?.items ?? []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Matches
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          {data
            ? `${data.totalItems.toLocaleString('en-GB')} ${
                upcoming ? 'scheduled fixtures' : 'completed matches'
              }`
            : 'Results and fixtures across every region'}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            { label: 'Results', href: qs({ view: 'results', page: 1 }), active: !upcoming },
            { label: 'Fixtures', href: qs({ view: 'upcoming', page: 1 }), active: upcoming },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
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
            label="Type"
            active={type}
            options={[
              { value: undefined, label: 'All' },
              { value: 2, label: 'Comp' },
              { value: 1, label: 'Ranked' },
              { value: 0, label: 'Friendly' },
            ]}
            hrefFor={(v) => qs({ type: v, page: 1 })}
          />
        </div>
      </div>

      {!data ? (
        <ErrorNote message="Could not reach the IOSoccer API. Please retry in a moment." />
      ) : grouped.length === 0 ? (
        <EmptyState
          title={upcoming ? 'No fixtures scheduled' : 'No matches found'}
          hint="Try clearing the filters."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, matches]) => (
            <section key={day}>
              <h2 className="label-xs mb-2 px-1">{day}</h2>
              <Card className="divide-y divide-[var(--line)] p-1">
                {matches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {data && (
        <Pagination
          page={data.page}
          totalPages={Math.min(data.totalPages, 400)}
          hrefFor={(p) => qs({ page: p })}
        />
      )}
    </div>
  );
}

function groupByDay(matches: Match[]): [string, Match[]][] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = dayLabel(m.kickOff);
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }
  return [...map.entries()];
}
