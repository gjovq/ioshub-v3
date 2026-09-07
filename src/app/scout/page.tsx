import Link from 'next/link';
import { ScoutList } from '@/components/scout-list';
import { ErrorNote } from '@/components/ui';
import {
  getCurrentTournaments,
  getPlayerStatistics,
  getPlayerStatisticsForTeam,
  getRegions,
  getTournamentTeams,
  safe,
} from '@/lib/api';
import type { PlayerStatistics, StatFilters } from '@/lib/types';

export const revalidate = 300;
export const metadata = { title: 'Scout' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 60;
const DEFAULTS = { page: 1, sort: 'Rating', order: 'DESC', period: 0, minApps: 5 };

/**
 * Division tiers. Named after the hub's competition ladder; the current
 * season's tournament and its team list are resolved at request time.
 * Division scoping goes through team membership because the statistics
 * endpoint's tournamentId filter is unreliable on live divisions.
 */
const DIVISIONS = [
  { key: 'premier', label: 'Premier' },
  { key: 'challenger', label: 'Challenger' },
  { key: 'ascendant', label: 'Ascendant' },
  { key: 'rising', label: 'Rising' },
] as const;

type DivisionKey = (typeof DIVISIONS)[number]['key'] | 'all';

async function resolveDivisionTeamIds(): Promise<Record<string, number[]>> {
  const tournaments = (await safe(getCurrentTournaments())) ?? [];
  const map: Record<string, number[]> = {};
  for (const d of DIVISIONS) {
    const t = tournaments.find((x) => x.name.toLowerCase().startsWith(d.key));
    if (!t) continue;
    const teams = await safe(getTournamentTeams(t.id));
    map[d.key] = (teams ?? []).map((tm) => tm.id);
  }
  return map;
}

/** Merge per-team result pages, de-duplicating players who appear twice. */
function mergeTeamStats(pages: (PlayerStatistics[] | null)[]): PlayerStatistics[] {
  const byId = new Map<number, PlayerStatistics>();
  for (const page of pages) {
    for (const p of page ?? []) {
      const existing = byId.get(p.playerId);
      if (!existing || p.appearances > existing.appearances) byId.set(p.playerId, p);
    }
  }
  return [...byId.values()];
}

export default async function ScoutPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const page = Math.max(1, Number(str('page')) || 1);
  const sort = str('sort') ?? DEFAULTS.sort;
  const order = (str('order') === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
  const period = Number(str('period') ?? DEFAULTS.period);
  const region = str('region') ? Number(str('region')) : undefined;
  const minApps = Number(str('minApps') ?? DEFAULTS.minApps);
  const minRating = str('minRating') ? Number(str('minRating')) : undefined;
  const pos = (str('pos') ?? 'all') as 'all' | 'GK' | 'DEF' | 'MID' | 'ATT';
  const division = (str('div') ?? 'all') as DivisionKey;

  const divisionTeamIds = await resolveDivisionTeamIds();

  const baseFilters: StatFilters = {
    timePeriod: Number.isFinite(period) ? period : 0,
    regionId: region ?? null,
    minimumAppearances: Number.isFinite(minApps) && minApps > 0 ? minApps : null,
    minimumRating: minRating ?? null,
  };

  let data: { items: PlayerStatistics[]; totalItems: number; totalPages: number; page: number } | null;
  if (division !== 'all' && divisionTeamIds[division]?.length) {
    // Division scope: query each member team and merge. The client list handles
    // search/heat ordering, so fetch a generous page per team.
    const pages = await Promise.all(
      divisionTeamIds[division].map((teamId) =>
        safe(getPlayerStatisticsForTeam({ teamId, pageSize: 200, filters: baseFilters })),
      ),
    );
    const merged = mergeTeamStats(pages.map((pg) => pg?.items ?? null));
    data = {
      items: merged,
      totalItems: merged.length,
      totalPages: 1,
      page: 1,
    };
  } else {
    const res = await safe(
      getPlayerStatistics({ page, pageSize: PAGE_SIZE, sortBy: sort, sortOrder: order, filters: baseFilters }),
    );
    data = res;
  }

  const regions = await safe(getRegions());

  const current = { page, sort, order, period, region, minApps, minRating, pos, div: division };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/scout', current, over, DEFAULTS);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Scout
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          {data
            ? `${data.totalItems.toLocaleString('en-GB')} players in scope — click a row for the full profile`
            : 'Filter by division, position and thresholds to find targets'}
        </p>
      </header>

      <div className="mb-6 space-y-2.5">
        {/* divisions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-xs hidden sm:inline">Division</span>
          <Pill href={qs({ div: 'all', page: 1 })} active={division === 'all'}>All</Pill>
          {DIVISIONS.map((d) => {
            const known = (divisionTeamIds[d.key]?.length ?? 0) > 0;
            return (
              <Pill
                key={d.key}
                href={qs({ div: d.key, page: 1 })}
                active={division === d.key}
                dimmed={!known}
                title={known ? undefined : 'Not in the current season'}
              >
                {d.label}
              </Pill>
            );
          })}
        </div>

        {/* position */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-xs hidden sm:inline">Position</span>
          {(['all', 'GK', 'DEF', 'MID', 'ATT'] as const).map((p) => (
            <Pill key={p} href={qs({ pos: p, page: 1 })} active={pos === p}>
              {p === 'all' ? 'All' : p}
            </Pill>
          ))}
        </div>

        {/* period + region + apps */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-xs hidden sm:inline">Period</span>
            {[
              { v: 0, l: 'All time' },
              { v: 365, l: 'Year' },
              { v: 31, l: 'Month' },
            ].map((t) => (
              <Pill key={t.v} href={qs({ period: t.v, page: 1 })} active={period === t.v}>
                {t.l}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-xs hidden sm:inline">Region</span>
            <Pill href={qs({ region: undefined, page: 1 })} active={region == null}>All</Pill>
            {(regions ?? [])
              .filter((r) => r.matchCount > 0)
              .map((r) => (
                <Pill key={r.regionId} href={qs({ region: r.regionId, page: 1 })} active={region === r.regionId}>
                  {r.regionCode}
                </Pill>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-xs hidden sm:inline">Min apps</span>
            {[1, 5, 10, 25, 50].map((a) => (
              <Pill key={a} href={qs({ minApps: a, page: 1 })} active={minApps === a}>
                {a}+
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {!data ? (
        <ErrorNote message="Could not load player statistics." />
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-chalk-500">
          No players match these filters — try a lower appearance threshold.
        </p>
      ) : (
        <ScoutList players={data.items} />
      )}
    </div>
  );
}

function buildQuery(
  base: string,
  current: Record<string, string | number | undefined>,
  over: Record<string, string | number | undefined>,
  defaults: Record<string, string | number>,
): string {
  const merged = { ...current, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '' || v === undefined) continue;
    if (k in defaults && String(defaults[k]) === String(v)) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

function Pill({
  href,
  active,
  children,
  dimmed,
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  dimmed?: boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25'
          : 'text-chalk-500 hover:bg-white/[0.04] hover:text-chalk-300'
      } ${dimmed ? 'pointer-events-none opacity-40' : ''}`}
    >
      {children}
    </Link>
  );
}
