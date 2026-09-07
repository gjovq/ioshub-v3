import Link from 'next/link';
import { ScoutList } from '@/components/scout-list';
import { ErrorNote } from '@/components/ui';
import { getRegions, safe } from '@/lib/api';
import { DIVISIONS, loadScoutPlayers, type DivisionKey } from '@/lib/scout-loader';

export const revalidate = 300;
export const metadata = { title: 'Scout' };

type SP = Promise<Record<string, string | string[] | undefined>>;

const DEFAULTS = { period: 0, minApps: 5, div: 'all' };

export default async function ScoutPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const period = [0, 31, 365].includes(Number(str('period'))) ? Number(str('period')) : 0;
  const positive = (key: string) => {
    const value = Number(str(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const region = positive('region');
  const minApps = Math.max(1, Math.floor(positive('minApps') ?? DEFAULTS.minApps));
  const minRating = positive('minRating');
  const division: DivisionKey = DIVISIONS.some((d) => d.key === str('div'))
    ? str('div') as DivisionKey : 'all';
  const [data, regions] = await Promise.all([
    safe(loadScoutPlayers({ period, region: region ?? null, minApps,
      minRating: minRating ?? null, division })),
    safe(getRegions()),
  ]);

  const current = { period, region, minApps, minRating, div: division };
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
            ? `${data.players.length.toLocaleString('en-GB')} eligible players, expand a row for the full profile`
            : 'Filter by division, position and thresholds to find targets'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-chalk-500">
          Division follows current squad membership. Statistics follow the selected period and region,
          including substitutes. Most-played position uses all-time recorded minutes across all regions.
          Search and position filters keep the same comparison group.
        </p>
      </header>

      <div className="mb-6 space-y-2.5">
        {/* divisions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-xs hidden sm:inline">Division</span>
          <Pill href={qs({ div: 'all' })} active={division === 'all'}>All</Pill>
          {DIVISIONS.map((d) => (
              <Pill
                key={d.key}
                href={qs({ div: d.key })}
                active={division === d.key}
              >
                {d.label}
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
              <Pill key={t.v} href={qs({ period: t.v })} active={period === t.v}>
                {t.l}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-xs hidden sm:inline">Region</span>
            <Pill href={qs({ region: undefined })} active={region == null}>All</Pill>
            {(regions ?? [])
              .filter((r) => r.matchCount > 0)
              .map((r) => (
                <Pill key={r.regionId} href={qs({ region: r.regionId })} active={region === r.regionId}>
                  {r.regionCode}
                </Pill>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-xs hidden sm:inline">Min apps</span>
            {[1, 5, 10, 25, 50].map((a) => (
              <Pill key={a} href={qs({ minApps: a })} active={minApps === a}>
                {a}+
              </Pill>
            ))}
          </div>
        </div>
        <form action="/scout" className="flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="div" value={division} />
          <input type="hidden" name="minApps" value={minApps} />
          {region != null && <input type="hidden" name="region" value={region} />}
          <label htmlFor="scout-min-rating" className="text-chalk-400">Minimum rating</label>
          <input id="scout-min-rating" name="minRating" type="number" min="0" step="0.1"
            defaultValue={minRating} className="w-20 rounded border border-[var(--line)] bg-pitch-950 px-2 py-1" />
          <button type="submit" className="rounded border border-[var(--line)] px-2 py-1 hover:text-turf-400">Apply</button>
        </form>
      </div>

      {!data ? (
        <ErrorNote message="Could not load a complete scouting population or current division squads. Try again later; partial results are not ranked." />
      ) : data.players.length === 0 ? (
        <p className="py-10 text-center text-sm text-chalk-500">
          No players match these filters. Try a lower appearance threshold.
        </p>
      ) : (
        <>
          {data.positionWarning && <p role="status" className="mb-3 rounded border border-[var(--line)] p-3 text-xs text-chalk-400">
            Some recorded-position histories are unavailable, tied, or do not reconcile with total playing time.
            Those players stay unclassified and cannot enter a position filter or receive a heat score.
          </p>}
          <ScoutList key={JSON.stringify(current)} players={data.players} teamNames={data.teamNames} />
        </>
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
