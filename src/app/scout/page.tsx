import Link from 'next/link';
import { HexagonChart } from '@/components/hexagon';
import { buildQuery, Pagination } from '@/components/controls';
import { Card, EmptyState, ErrorNote } from '@/components/ui';
import { getRegions, getPlayerStatistics, safe, getCurrentTournaments } from '@/lib/api';
import { duration, num, pct } from '@/lib/format';
import {
  hexagonAxes,
  POSITION_COLORS,
  positionGroupOfStats,
  scoutScore,
} from '@/lib/scouting';
import type { PlayerStatistics, StatFilters } from '@/lib/types';

export const revalidate = 300;
export const metadata = { title: 'Scout' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 20;
const DEFAULTS = { page: 1, sort: 'Rating', order: 'DESC', period: 0, minApps: 5 };

/**
 * Division tiers. Names map onto current tournament names (e.g.
 * "Premier Season 5"); IDs are resolved at request time so a new season
 * keeps working without code changes.
 */
const DIVISIONS = [
  { key: 'premier', label: 'Premier', tier: 1 },
  { key: 'challenger', label: 'Challenger', tier: 2 },
  { key: 'ascendant', label: 'Ascendant', tier: 3 },
  { key: 'rising', label: 'Rising', tier: 4 },
] as const;

type DivisionKey = (typeof DIVISIONS)[number]['key'] | 'all';

async function resolveDivisionIds(): Promise<Record<string, number>> {
  const tournaments = await safe(getCurrentTournaments());
  const map: Record<string, number> = {};
  for (const d of DIVISIONS) {
    const t = (tournaments ?? []).find((x) =>
      x.name.toLowerCase().startsWith(d.key),
    );
    if (t) map[d.key] = t.id;
  }
  return map;
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
  const maxGoals = str('maxGoals') ? Number(str('maxGoals')) : undefined;
  const minPassPct = str('minPass') ? Number(str('minPass')) : undefined;
  const minPass = minPassPct;

  const divisionIds = await resolveDivisionIds();

  const filters: StatFilters = {
    timePeriod: Number.isFinite(period) ? period : 0,
    regionId: region ?? null,
    minimumAppearances: Number.isFinite(minApps) && minApps > 0 ? minApps : null,
    minimumRating: minRating ?? null,
    positionName: pos === 'GK' ? 'GK' : null,
    tournamentId: division !== 'all' ? (divisionIds[division] ?? null) : null,
  };

  const [data, regions] = await Promise.all([
    safe(getPlayerStatistics({ page, pageSize: PAGE_SIZE, sortBy: sort, sortOrder: order, filters })),
    safe(getRegions()),
  ]);

  // Post-filters the API cannot express: computed position, pass % floor and a
  // goals ceiling (find underrated non-scorers). Applied to the fetched page.
  const rows = (data?.items ?? []).filter((p) => {
    if (pos !== 'all' && pos !== 'GK' && positionGroupOfStats(p) !== pos) return false;
    if (minPassPct != null && p.passCompletionPercentageAverage < minPassPct) return false;
    if (maxGoals != null && p.goals / Math.max(1, p.appearances) > maxGoals) return false;
    return true;
  });

  const current = { page, sort, order, period, region, minApps, minRating, pos, div: division, maxGoals, minPass };
  const qs = (over: Record<string, string | number | undefined>) =>
    buildQuery('/scout', current, over, DEFAULTS);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Scout
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          {data
            ? `${data.totalItems.toLocaleString('en-GB')} players in scope — ranked by scout heat`
            : 'Filter by division, position and stat thresholds to find targets'}
        </p>
      </header>

      <FilterBar
        regions={regions ?? []}
        division={division}
        divisionIds={divisionIds}
        pos={pos}
        period={period}
        region={region}
        minApps={minApps}
        qs={qs}
      />

      {!data ? (
        <ErrorNote message="Could not load player statistics." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No players match these filters"
          hint="Try a lower appearance threshold or widen the division filter."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((p) => (
            <ScoutCard key={p.playerId} p={p} />
          ))}
        </div>
      )}

      {data && (
        <Pagination
          page={data.page}
          totalPages={Math.min(data.totalPages, 200)}
          hrefFor={(p2) => qs({ page: p2 })}
        />
      )}
    </div>
  );
}

function FilterBar({
  regions,
  division,
  divisionIds,
  pos,
  period,
  region,
  minApps,
  qs,
}: {
  regions: { regionId: number; regionCode: string; matchCount: number }[];
  division: DivisionKey;
  divisionIds: Record<string, number>;
  pos: string;
  period: number;
  region?: number;
  minApps: number;
  qs: (over: Record<string, string | number | undefined>) => string;
}) {
  const pill =
    'rounded-md px-2 py-1 text-xs font-semibold transition-colors';
  const activePill = 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25';
  const idlePill = 'text-chalk-500 hover:bg-white/[0.04] hover:text-chalk-300';

  return (
    <div className="mb-6 space-y-3">
      {/* divisions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-xs hidden sm:inline">Division</span>
        <Link href={qs({ div: 'all', page: 1 })} className={`${pill} ${division === 'all' ? activePill : idlePill}`}>
          All
        </Link>
        {DIVISIONS.map((d) => {
          const known = d.key in divisionIds;
          return (
            <Link
              key={d.key}
              href={qs({ div: d.key, page: 1 })}
              className={`${pill} ${division === d.key ? activePill : idlePill} ${known ? '' : 'opacity-40 pointer-events-none'}`}
              title={known ? undefined : 'Division not in the current season'}
            >
              {d.label}
            </Link>
          );
        })}
      </div>

      {/* position */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-xs hidden sm:inline">Position</span>
        {(['all', 'GK', 'DEF', 'MID', 'ATT'] as const).map((p) => (
          <Link key={p} href={qs({ pos: p, page: 1 })} className={`${pill} ${pos === p ? activePill : idlePill}`}>
            {p === 'all' ? 'All' : p}
          </Link>
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
            <Link key={t.v} href={qs({ period: t.v, page: 1 })} className={`${pill} ${period === t.v ? activePill : idlePill}`}>
              {t.l}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-xs hidden sm:inline">Region</span>
          <Link href={qs({ region: undefined, page: 1 })} className={`${pill} ${region == null ? activePill : idlePill}`}>
            All
          </Link>
          {regions
            .filter((r) => r.matchCount > 0)
            .map((r) => (
              <Link key={r.regionId} href={qs({ region: r.regionId, page: 1 })} className={`${pill} ${region === r.regionId ? activePill : idlePill}`}>
                {r.regionCode}
              </Link>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-xs hidden sm:inline">Min apps</span>
          {[1, 5, 10, 25, 50].map((a) => (
            <Link key={a} href={qs({ minApps: a, page: 1 })} className={`${pill} ${minApps === a ? activePill : idlePill}`}>
              {a}+
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoutCard({ p }: { p: PlayerStatistics }) {
  const axes = hexagonAxes(p);
  const heat = scoutScore(p);
  const group = positionGroupOfStats(p);
  const color = POSITION_COLORS[group];
  const heatColor =
    heat >= 70 ? 'bg-turf-500/20 text-turf-300' : heat >= 45 ? 'bg-flare-500/15 text-flare-400' : 'bg-white/[0.06] text-chalk-400';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold text-white"
            style={{ background: `${color}33`, color }}
          >
            {group}
          </span>
          <div className="min-w-0">
            <Link
              href={`/players/${p.playerId}`}
              className="block max-w-[12rem] truncate font-display text-sm font-bold text-chalk-100 transition-colors hover:text-turf-400"
            >
              {p.name}
            </Link>
            <div className="text-[11px] text-chalk-600">
              {num(p.appearances)} apps · {duration(p.secondsPlayed)}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`tabular rounded-md px-2 py-1 text-sm font-bold ${heatColor}`} title="Scout heat: output, creation, passing, winning, minutes">
            {heat}
          </span>
          <div className="label-xs mt-1">heat</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Rating" value={p.rating > 0 ? p.rating.toFixed(2) : '–'} />
        <MiniStat label="G+A /m" value={((p.goals + p.assists) / Math.max(1, p.appearances)).toFixed(2)} />
        <MiniStat label="Pass %" value={pct(p.passCompletionPercentageAverage, true)} />
      </div>

      <div className="mx-auto mt-1 max-w-[240px]">
        <HexagonChart axes={axes} color={color} size={220} />
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <div className="label-xs">{label}</div>
      <div className="tabular mt-0.5 text-sm font-bold text-chalk-100">{value}</div>
    </div>
  );
}
