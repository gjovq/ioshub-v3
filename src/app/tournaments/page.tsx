import Link from 'next/link';
import { buildQuery, Tabs } from '@/components/controls';
import { TeamBadge } from '@/components/team-badge';
import { Badge, EmptyState, ErrorNote } from '@/components/ui';
import { getCurrentTournaments, getPastTournaments, safe } from '@/lib/api';
import { TOURNAMENT_TYPE_LABEL } from '@/lib/enums';
import { fmtDate, teamLabel } from '@/lib/format';
import type { Tournament } from '@/lib/types';

export const revalidate = 600;
export const metadata = { title: 'Tournaments' };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === 'past' ? 'past' : 'current';
  const org = typeof sp.org === 'string' ? sp.org : undefined;

  const [current, past] = await Promise.all([
    safe(getCurrentTournaments()),
    tab === 'past' ? safe(getPastTournaments()) : Promise.resolve(null),
  ]);

  const list = tab === 'past' ? (past ?? []) : (current ?? []);

  const byOrg = new Map<string, Tournament[]>();
  for (const t of list) {
    const key =
      t.tournamentSeries?.organisation?.name ??
      t.tournamentSeries?.name ??
      'Independent';
    const arr = byOrg.get(key);
    if (arr) arr.push(t);
    else byOrg.set(key, [t]);
  }

  const orgs = [...byOrg.entries()].sort((a, b) => b[1].length - a[1].length);
  const shown = org ? orgs.filter(([name]) => name === org) : orgs;

  const qs = (over: Record<string, string | undefined>) =>
    buildQuery('/tournaments', { tab, org }, over, { tab: 'current' });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Tournaments
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          Organised competitions across the IOSoccer community.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            {
              label: 'Active',
              href: qs({ tab: 'current', org: undefined }),
              active: tab === 'current',
              count: current?.length,
            },
            {
              label: 'Past',
              href: qs({ tab: 'past', org: undefined }),
              active: tab === 'past',
            },
          ]}
        />
        {orgs.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <Link
              href={qs({ org: undefined })}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                !org
                  ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25'
                  : 'text-chalk-500 hover:bg-white/[0.04] hover:text-chalk-300'
              }`}
            >
              All organisers
            </Link>
            {orgs.slice(0, 8).map(([name, items]) => (
              <Link
                key={name}
                href={qs({ org: name })}
                className={`max-w-[12rem] truncate rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  org === name
                    ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25'
                    : 'text-chalk-500 hover:bg-white/[0.04] hover:text-chalk-300'
                }`}
              >
                {name} <span className="opacity-50">{items.length}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {tab === 'past' && past === null ? (
        <ErrorNote message="Could not load past tournaments." />
      ) : shown.length === 0 ? (
        <EmptyState
          title={tab === 'past' ? 'No past tournaments found' : 'No active tournaments'}
          hint="Check the other tab for more competitions."
          icon="🏆"
        />
      ) : (
        <div className="space-y-9">
          {shown.map(([orgName, items]) => (
            <section key={orgName}>
              <div className="mb-3 flex items-center gap-3">
                <OrgMark
                  color={items[0]?.tournamentSeries?.organisation?.brandColour}
                  acronym={
                    items[0]?.tournamentSeries?.organisation?.acronym ??
                    orgName.slice(0, 3).toUpperCase()
                  }
                />
                <div>
                  <h2 className="font-display text-base font-semibold text-chalk-100">
                    {orgName}
                  </h2>
                  <p className="text-xs text-chalk-600">
                    {items.length} competition{items.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.startDate ?? 0).getTime() -
                      new Date(a.startDate ?? 0).getTime(),
                  )
                  .slice(0, org ? 60 : 9)
                  .map((t) => (
                    <TournamentCard key={t.id} tournament={t} />
                  ))}
              </div>
              {!org && items.length > 9 && (
                <Link
                  href={qs({ org: orgName })}
                  className="mt-3 inline-block text-sm text-chalk-500 transition-colors hover:text-turf-400"
                >
                  Show all {items.length} from {orgName} →
                </Link>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const status = t.hasEnded ? 'Finished' : t.hasStarted ? 'In progress' : 'Upcoming';
  const tone = t.hasEnded ? 'muted' : t.hasStarted ? 'success' : 'info';

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className="surface group flex flex-col p-4 transition-all hover:border-[var(--line-strong)] hover:bg-white/[0.02]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold leading-snug text-chalk-100 transition-colors group-hover:text-turf-400">
          {t.name}
        </h3>
        {t.hasEnded && t.winningTeam && <span className="shrink-0 text-sm">🏆</span>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={tone}>{status}</Badge>
        <Badge tone="muted">
          {t.format}v{t.format}
        </Badge>
        {TOURNAMENT_TYPE_LABEL[t.tournamentType] && (
          <span className="text-[11px] text-chalk-600">
            {TOURNAMENT_TYPE_LABEL[t.tournamentType]}
          </span>
        )}
      </div>

      {t.winningTeam && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-flare-500/[0.07] px-2.5 py-2">
          <TeamBadge team={t.winningTeam} size="sm" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-flare-400">
            {teamLabel(t.winningTeam)}
          </span>
          <span className="label-xs !text-flare-500/70">champion</span>
        </div>
      )}

      <div className="mt-auto text-[11px] text-chalk-600">
        {fmtDate(t.startDate)}
        {t.endDate && ` – ${fmtDate(t.endDate)}`}
      </div>
    </Link>
  );
}

function OrgMark({
  color,
  acronym,
}: {
  color: string | null | undefined;
  acronym: string;
}) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold text-white/90 ring-1 ring-inset ring-white/10"
      style={{ background: color ?? '#1e2836' }}
    >
      {acronym.slice(0, 4)}
    </span>
  );
}
