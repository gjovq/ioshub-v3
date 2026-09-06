import { Suspense } from 'react';
import Link from 'next/link';
import { MatchRow } from '@/components/match-card';
import { TeamBadge } from '@/components/team-badge';
import {
  Badge,
  Card,
  EmptyState,
  FormRun,
  SectionHeader,
  Skeleton,
  Stat,
} from '@/components/ui';
import { loadTournament, requireEntity } from '@/lib/entities';
import {
  getMatches,
  getStandings,
  getTournamentGroups,
  getTournamentTeams,
  safe,
} from '@/lib/api';
import { TEAM_TYPE_LABEL, TOURNAMENT_TYPE_LABEL } from '@/lib/enums';
import { fmtDate, matchScore, num, teamLabel } from '@/lib/format';
import type { Standing, TournamentGroup } from '@/lib/types';

export const revalidate = 300;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const t = await loadTournament(Number(id));
  return { title: t?.name ?? 'Tournament not found' };
}

export default async function TournamentPage({ params }: { params: Params }) {
  const { id } = await params;
  const tid = Number(id);
  const tournament = await requireEntity(loadTournament(tid));

  const [teams, matchPage] = await Promise.all([
    safe(getTournamentTeams(tid)),
    safe(
      getMatches({
        pageSize: 100,
        sortBy: 'KickOff',
        sortOrder: 'ASC',
        filters: {
          includePast: true,
          includeUpcoming: true,
          includePlaceholders: true,
          tournamentId: tid,
        },
      }),
    ),
  ]);

  const matches = matchPage?.items ?? [];
  const played = matches.filter((m) => matchScore(m) !== null);
  const upcoming = matches.filter((m) => matchScore(m) === null);

  const goals = played.reduce((acc, m) => {
    const s = matchScore(m);
    return acc + (s ? s.home + s.away : 0);
  }, 0);

  const status = tournament.hasEnded
    ? 'Finished'
    : tournament.hasStarted
      ? 'In progress'
      : 'Upcoming';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-chalk-600">
        <Link href="/tournaments" className="transition-colors hover:text-chalk-300">
          Tournaments
        </Link>
        <span>/</span>
        <span className="text-chalk-500">{tournament.name}</span>
      </nav>

      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background:
              tournament.tournamentSeries?.organisation?.brandColour ?? '#22c55e',
          }}
        />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
              {tournament.name}
            </h1>
            <p className="mt-1 text-sm text-chalk-500">
              {tournament.tournamentSeries?.organisation?.name ??
                tournament.tournamentSeries?.name ??
                'Independent competition'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge
                tone={
                  tournament.hasEnded ? 'muted' : tournament.hasStarted ? 'success' : 'info'
                }
              >
                {status}
              </Badge>
              <Badge tone="neutral">
                {tournament.format}v{tournament.format}
              </Badge>
              <Badge tone="muted">
                {TEAM_TYPE_LABEL[tournament.teamType] ?? 'Teams'}
              </Badge>
              {TOURNAMENT_TYPE_LABEL[tournament.tournamentType] && (
                <Badge tone="muted">
                  {TOURNAMENT_TYPE_LABEL[tournament.tournamentType]}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-xs text-chalk-600">
              {fmtDate(tournament.startDate)}
              {tournament.endDate && ` – ${fmtDate(tournament.endDate)}`}
            </p>
          </div>

          {tournament.winningTeam && (
            <Link
              href={`/teams/${tournament.winningTeam.id}`}
              className="flex items-center gap-3 rounded-xl bg-flare-500/[0.08] px-4 py-3 ring-1 ring-inset ring-flare-500/20 transition-colors hover:bg-flare-500/[0.12]"
            >
              <span className="text-2xl">🏆</span>
              <div>
                <div className="label-xs !text-flare-500/70">Champion</div>
                <div className="mt-0.5 font-display text-sm font-bold text-flare-400">
                  {teamLabel(tournament.winningTeam)}
                </div>
              </div>
            </Link>
          )}
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={num(teams?.length ?? 0)} />
        <Stat label="Matches played" value={num(played.length)} />
        <Stat label="Goals scored" value={num(goals)} accent />
        <Stat
          label="Goals / match"
          value={played.length ? (goals / played.length).toFixed(2) : '–'}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <Suspense fallback={<SectionSkeleton title="Standings" rows={8} />}>
            <StandingsSection tournamentId={tid} />
          </Suspense>

          {upcoming.length > 0 && (
            <section>
              <SectionHeader
                title="Fixtures"
                subtitle={`${upcoming.length} matches to play`}
              />
              <Card className="divide-y divide-[var(--line)] p-1">
                {upcoming.slice(0, 15).map((m) => (
                  <MatchRow key={m.id} match={m} showDate />
                ))}
              </Card>
            </section>
          )}

          {played.length > 0 && (
            <section>
              <SectionHeader
                title="Results"
                subtitle={`${played.length} matches played`}
              />
              <Card className="divide-y divide-[var(--line)] p-1">
                {played
                  .slice()
                  .reverse()
                  .slice(0, 25)
                  .map((m) => (
                    <MatchRow key={m.id} match={m} showDate />
                  ))}
              </Card>
            </section>
          )}

          {matches.length === 0 && (
            <EmptyState
              title="No fixtures published yet"
              hint="Schedules and tables appear once the organiser publishes them."
              icon="📅"
            />
          )}
        </div>

        <aside className="space-y-6">
          {teams && teams.length > 0 && (
            <section>
              <SectionHeader title="Entrants" subtitle={`${teams.length} teams`} />
              <Card className="divide-y divide-[var(--line)]">
                {teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <TeamBadge team={t} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-chalk-200">
                      {teamLabel(t)}
                    </span>
                    <FormRun form={t.form} size="sm" max={3} />
                  </Link>
                ))}
              </Card>
            </section>
          )}

          <Suspense fallback={null}>
            <StagesSection tournamentId={tid} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

function StandingsTable({
  group,
  rows,
}: {
  group: TournamentGroup;
  rows: Standing[];
}) {
  const promotion = rows.length > 6 ? Math.min(4, Math.floor(rows.length / 2)) : 2;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h3 className="font-display text-sm font-bold text-chalk-100">{group.name}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="label-xs w-9 px-3 py-2 text-left">#</th>
              <th className="label-xs px-2 py-2 text-left">Team</th>
              <th className="label-xs px-2 py-2 text-center">P</th>
              <th className="label-xs px-2 py-2 text-center">W</th>
              <th className="label-xs px-2 py-2 text-center">D</th>
              <th className="label-xs px-2 py-2 text-center">L</th>
              <th className="label-xs px-2 py-2 text-center">GF</th>
              <th className="label-xs px-2 py-2 text-center">GA</th>
              <th className="label-xs px-2 py-2 text-center">GD</th>
              <th className="label-xs px-2 py-2 text-center">Pts</th>
              <th className="label-xs px-3 py-2 text-center">Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((r) => (
              <tr key={r.teamId} className="transition-colors hover:bg-white/[0.025]">
                <td className="relative px-3 py-2.5">
                  {r.position <= promotion && (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-turf-500" />
                  )}
                  <span className="tabular text-xs text-chalk-500">{r.position}</span>
                </td>
                <td className="px-2 py-2.5">
                  <Link
                    href={`/teams/${r.teamId}`}
                    className="flex items-center gap-2 transition-colors hover:text-turf-400"
                  >
                    <TeamBadge url={r.badgeImageUrl} name={r.teamName} size="xs" />
                    <span className="max-w-[11rem] truncate font-medium text-chalk-100">
                      {r.teamName}
                    </span>
                  </Link>
                </td>
                <Num>{r.matchesPlayed}</Num>
                <Num>{r.wins}</Num>
                <Num>{r.draws}</Num>
                <Num>{r.losses}</Num>
                <Num>{r.goalsScored}</Num>
                <Num dim>{r.goalsConceded}</Num>
                <Num>
                  <span
                    className={
                      r.goalDifference > 0
                        ? 'text-turf-400'
                        : r.goalDifference < 0
                          ? 'text-red-400/80'
                          : ''
                    }
                  >
                    {r.goalDifference > 0 ? '+' : ''}
                    {r.goalDifference}
                  </span>
                </Num>
                <td className="tabular px-2 py-2.5 text-center font-bold text-chalk-100">
                  {r.points}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-center">
                    <FormRun form={r.form} size="sm" max={5} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Num({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <td
      className={`tabular px-2 py-2.5 text-center ${dim ? 'text-chalk-500' : 'text-chalk-300'}`}
    >
      {children}
    </td>
  );
}


// ---------------------------------------------------------- streamed blocks

/** Standings need one request per group, so they stream in separately. */
async function StandingsSection({ tournamentId }: { tournamentId: number }) {
  const groups = await safe(getTournamentGroups(tournamentId));
  const withTeams = (groups ?? []).filter(
    (g) => (g.tournamentGroupTeams?.length ?? 0) > 0,
  );
  if (withTeams.length === 0) return null;

  const tables = await Promise.all(
    withTeams.slice(0, 8).map(async (group) => ({
      group,
      rows: await safe(getStandings(group.id)),
    })),
  );
  const populated = tables.filter((t) => t.rows && t.rows.length > 0);
  if (populated.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Standings" subtitle="Group tables" />
      <div className="space-y-4">
        {populated.map(({ group, rows }) => (
          <StandingsTable key={group.id} group={group} rows={rows!} />
        ))}
      </div>
    </section>
  );
}

async function StagesSection({ tournamentId }: { tournamentId: number }) {
  const groups = await safe(getTournamentGroups(tournamentId));
  if (!groups || groups.length < 2) return null;

  return (
    <section>
      <SectionHeader title="Stages" />
      <Card className="divide-y divide-[var(--line)] text-sm">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="truncate text-chalk-300">{g.name}</span>
            <span className="tabular shrink-0 text-xs text-chalk-600">
              {g.tournamentGroupTeams?.length ?? 0} teams
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

function SectionSkeleton({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <section>
      <SectionHeader title={title} />
      <Card className="space-y-2 p-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Card>
    </section>
  );
}
