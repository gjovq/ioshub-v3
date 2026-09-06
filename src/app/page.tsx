import Link from 'next/link';
import { LiveStrip } from '@/components/live-strip';
import { MatchCard, MatchRow } from '@/components/match-card';
import { TeamBadge } from '@/components/team-badge';
import { Badge, Card, EmptyState, FormRun, SectionHeader } from '@/components/ui';
import {
  getCurrentTournaments,
  getMatches,
  getPlayerStatistics,
  getRegions,
  getTeamStatistics,
  safe,
} from '@/lib/api';
import { compact, fmtDate, num } from '@/lib/format';

export const revalidate = 60;

export default async function HomePage() {
  const [regions, recent, upcoming, tournaments, topScorers, topTeams] = await Promise.all([
    safe(getRegions()),
    safe(getMatches({ pageSize: 8, filters: { includePast: true }, sortOrder: 'DESC' })),
    safe(
      getMatches({
        pageSize: 6,
        filters: { includeUpcoming: true },
        sortBy: 'KickOff',
        sortOrder: 'ASC',
      }),
    ),
    safe(getCurrentTournaments()),
    safe(
      getPlayerStatistics({
        pageSize: 6,
        sortBy: 'Goals',
        sortOrder: 'DESC',
        filters: { timePeriod: 31, minimumAppearances: 5 },
      }),
    ),
    safe(
      getTeamStatistics({
        pageSize: 6,
        sortBy: 'Points',
        sortOrder: 'DESC',
        filters: { timePeriod: 31, minimumMatches: 3 },
      }),
    ),
  ]);

  const totals = (regions ?? []).reduce(
    (acc, r) => ({
      matches: acc.matches + r.matchCount,
      teams: acc.teams + r.teamCount,
      servers: acc.servers + r.serverCount,
    }),
    { matches: 0, teams: 0, servers: 0 },
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <Hero totals={totals} />

      <LiveStrip />

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-12">
          <section>
            <SectionHeader
              title="Latest results"
              subtitle="Most recently completed matches"
              href="/matches"
            />
            {recent?.items.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {recent.items.slice(0, 4).map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            ) : (
              <EmptyState title="No recent results" />
            )}
            {recent && recent.items.length > 4 && (
              <Card className="mt-3 divide-y divide-[var(--line)] p-1">
                {recent.items.slice(4).map((m) => (
                  <MatchRow key={m.id} match={m} showDate />
                ))}
              </Card>
            )}
          </section>

          <section>
            <SectionHeader
              title="Upcoming fixtures"
              subtitle="Scheduled kick-offs"
              href="/matches?view=upcoming"
            />
            {upcoming?.items.length ? (
              <Card className="divide-y divide-[var(--line)] p-1">
                {upcoming.items.map((m) => (
                  <MatchRow key={m.id} match={m} showDate />
                ))}
              </Card>
            ) : (
              <EmptyState title="Nothing scheduled" hint="Check back later for fixtures." />
            )}
          </section>

          <section>
            <SectionHeader
              title="Active tournaments"
              subtitle="Competitions currently running"
              href="/tournaments"
            />
            {tournaments?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {tournaments.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/${t.id}`}
                    className="surface group flex items-start gap-3.5 p-4 transition-all hover:border-[var(--line-strong)] hover:bg-white/[0.02]"
                  >
                    <TournamentMark
                      color={t.tournamentSeries?.organisation?.brandColour}
                      acronym={
                        t.tournamentSeries?.organisation?.acronym ??
                        t.name.slice(0, 3).toUpperCase()
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[15px] font-semibold text-chalk-100 group-hover:text-turf-400">
                        {t.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-chalk-500">
                        {t.tournamentSeries?.organisation?.name ??
                          t.tournamentSeries?.name ??
                          'Independent'}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={t.hasStarted ? 'success' : 'info'}>
                          {t.hasStarted ? 'In progress' : 'Upcoming'}
                        </Badge>
                        <Badge tone="muted">{t.format}v{t.format}</Badge>
                        {t.startDate && (
                          <span className="text-[11px] text-chalk-600">
                            {fmtDate(t.startDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No active tournaments" icon="🏆" />
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <SectionHeader title="Top scorers" subtitle="Last 30 days" href="/leaders" />
            <Card className="divide-y divide-[var(--line)] p-1">
              {topScorers?.items.length ? (
                topScorers.items.map((p, i) => (
                  <Link
                    key={p.playerId}
                    href={`/players/${p.playerId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.035]"
                  >
                    <RankPill rank={i + 1} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-chalk-200">
                      {p.name}
                    </span>
                    <span className="tabular text-sm font-bold text-turf-400">{p.goals}</span>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-sm text-chalk-600">No data</div>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader
              title="Form table"
              subtitle="Points, last 30 days"
              href="/teams"
            />
            <Card className="divide-y divide-[var(--line)] p-1">
              {topTeams?.items.length ? (
                topTeams.items.map((t, i) => (
                  <Link
                    key={t.teamId}
                    href={`/teams/${t.teamId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.035]"
                  >
                    <RankPill rank={i + 1} />
                    <TeamBadge url={t.badgeImageUrl} name={t.teamName} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-chalk-200">
                      {t.teamName}
                    </span>
                    <FormRun form={t.form} size="sm" max={3} />
                    <span className="tabular w-6 text-right text-sm font-bold text-chalk-100">
                      {t.points}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-sm text-chalk-600">No data</div>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader title="Regions" subtitle="Community activity" />
            <Card className="divide-y divide-[var(--line)]">
              {(regions ?? [])
                .filter((r) => r.matchCount > 0)
                .sort((a, b) => b.matchCount - a.matchCount)
                .map((r) => (
                  <div key={r.regionId} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-11 shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-center font-mono text-[10px] font-bold text-chalk-400">
                      {r.regionCode}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-chalk-300">
                      {r.regionName}
                    </span>
                    <span className="tabular shrink-0 text-xs text-chalk-500">
                      {compact(r.matchCount)} matches
                    </span>
                  </div>
                ))}
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Hero({ totals }: { totals: { matches: number; teams: number; servers: number } }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-pitch-800/70 via-pitch-900/60 to-pitch-950 px-6 py-10 sm:px-10 sm:py-14">
      <PitchLines />
      <div className="relative max-w-2xl">
        <Badge tone="success" className="mb-4">
          Live data · public IOSoccer API
        </Badge>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chalk-100 sm:text-5xl">
          Every match, every stat,
          <br />
          <span className="bg-gradient-to-r from-turf-400 to-turf-600 bg-clip-text text-transparent">
            one hub.
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-chalk-400">
          Live scores, full match breakdowns, player and team analytics, tournament
          standings and league-wide leaderboards.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-lg bg-turf-500 px-4 py-2.5 text-sm font-semibold text-pitch-950 shadow-lg shadow-turf-500/20 transition-all hover:bg-turf-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pitch-950" />
            Live scores
          </Link>
          <Link
            href="/leaders"
            className="rounded-lg border border-[var(--line-strong)] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-chalk-200 transition-colors hover:bg-white/[0.07]"
          >
            Leaderboards
          </Link>
        </div>
        <dl className="mt-9 grid max-w-lg grid-cols-3 gap-6 border-t border-[var(--line)] pt-6">
          <HeroStat label="Matches played" value={compact(totals.matches)} />
          <HeroStat label="Teams" value={num(totals.teams)} />
          <HeroStat label="Servers" value={num(totals.servers)} />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="tabular font-display text-2xl font-bold text-chalk-100 sm:text-3xl">
        {value}
      </dd>
      <dt className="label-xs mt-1">{label}</dt>
    </div>
  );
}

function PitchLines() {
  return (
    <svg
      className="pointer-events-none absolute -right-20 -top-16 h-[130%] w-[520px] text-turf-500/[0.055]"
      viewBox="0 0 400 500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="20" y="20" width="360" height="460" />
      <line x1="20" y1="250" x2="380" y2="250" />
      <circle cx="200" cy="250" r="70" />
      <circle cx="200" cy="250" r="4" fill="currentColor" />
      <rect x="90" y="20" width="220" height="90" />
      <rect x="140" y="20" width="120" height="40" />
      <rect x="90" y="390" width="220" height="90" />
      <rect x="140" y="440" width="120" height="40" />
    </svg>
  );
}

function RankPill({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? 'bg-flare-500/15 text-flare-400'
      : rank <= 3
        ? 'bg-white/[0.07] text-chalk-300'
        : 'text-chalk-600';
  return (
    <span
      className={`tabular flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${tone}`}
    >
      {rank}
    </span>
  );
}

function TournamentMark({
  color,
  acronym,
}: {
  color: string | null | undefined;
  acronym: string;
}) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold text-white/90 ring-1 ring-inset ring-white/10"
      style={{ background: color ?? '#1e2836' }}
    >
      {acronym.slice(0, 4)}
    </span>
  );
}
