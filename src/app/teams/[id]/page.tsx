import { Suspense } from 'react';
import Link from 'next/link';
import { ActivityStrip, PerformanceChart, ResultsBar } from '@/components/charts';
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
import { loadTeam, requireEntity } from '@/lib/entities';
import {
  getMatches,
  getTeamAggregate,
  getTeamMatchTotals,
  getTeamPerformance,
  getTeamSquad,
  getTournamentsForTeam,
  safe,
} from '@/lib/api';
import { TEAM_ROLE_LABEL, TEAM_TYPE_LABEL } from '@/lib/enums';
import {
  cleanName,
  contrastOn,
  fmtDate,
  num,
  pct,
  safeColor,
  teamLabel,
} from '@/lib/format';
import type { SquadEntry } from '@/lib/types';

export const revalidate = 300;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const t = await loadTeam(Number(id));
  return { title: t ? teamLabel(t) : 'Team not found' };
}

export default async function TeamPage({ params }: { params: Params }) {
  const { id } = await params;
  const teamId = Number(id);
  const team = await requireEntity(loadTeam(teamId));

  const stats = await safe(getTeamAggregate(teamId));
  const color = safeColor(team.color, '#26323f');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-chalk-600">
        <Link href="/teams" className="transition-colors hover:text-chalk-300">
          Teams
        </Link>
        <span>/</span>
        <span className="text-chalk-500">{teamLabel(team)}</span>
      </nav>

      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-24 opacity-25"
          style={{ background: `linear-gradient(180deg, ${color}, transparent)` }}
        />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-start gap-5">
            <TeamBadge team={team} size="xl" className="!h-20 !w-20" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
                {teamLabel(team)}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {team.teamCode && (
                  <span
                    className="rounded px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{ background: color, color: contrastOn(color) }}
                  >
                    {team.teamCode}
                  </span>
                )}
                <Badge tone="neutral">{TEAM_TYPE_LABEL[team.teamType] ?? 'Team'}</Badge>
                {team.region && <Badge tone="muted">{team.region.regionName}</Badge>}
                {team.inactive ? (
                  <Badge tone="warn">Inactive</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-chalk-600">
                {team.foundedDate && <span>Founded {fmtDate(team.foundedDate)}</span>}
                {team.form && team.form.length > 0 && (
                  <span className="flex items-center gap-2">
                    Recent form <FormRun form={team.form} size="sm" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Matches" value={num(stats.appearances)} />
          <Stat label="Points" value={num(stats.points)} accent />
          <Stat label="Goals for" value={num(stats.goals)} sub={`${stats.goalsAverage.toFixed(1)} per match`} />
          <Stat label="Goals against" value={num(stats.goalsConceded)} sub={`${stats.goalsConcededAverage.toFixed(1)} per match`} />
          <Stat
            label="Goal difference"
            value={`${stats.goalDifference > 0 ? '+' : ''}${num(stats.goalDifference)}`}
          />
          <Stat label="Win rate" value={pct(stats.winPercentage)} sub={`${stats.wins}W ${stats.draws}D ${stats.losses}L`} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Suspense fallback={<SectionSkeleton title="Squad" rows={8} />}>
            <SquadSection teamId={teamId} />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Matches" rows={6} />}>
            <MatchesSection teamId={teamId} />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Performance trend" rows={3} />}>
            <TrendSection teamId={teamId} />
          </Suspense>
        </div>

        <aside className="space-y-6">
          {stats && (
            <>
              <section>
                <SectionHeader title="Results" />
                <Card className="p-5">
                  <ResultsBar wins={stats.wins} draws={stats.draws} losses={stats.losses} />
                </Card>
              </section>

              <section>
                <SectionHeader title="Style profile" subtitle="Per-match averages" />
                <Card className="space-y-3 p-5 text-sm">
                  <Row label="Possession" value={pct(stats.possessionPercentageAverage, true)} />
                  <Row label="Pass accuracy" value={pct(stats.passCompletionPercentageAverage)} />
                  <Row label="Passes" value={num(stats.passesAverage ?? 0, 0)} />
                  <Row label="Shots" value={num(stats.shotsAverage ?? 0, 1)} />
                  <Row label="Shot accuracy" value={pct(stats.shotAccuracyPercentage)} />
                  <Row label="Conversion" value={pct(stats.shotConversionPercentage)} />
                  <Row label="Interceptions" value={num(stats.interceptionsAverage, 1)} />
                  <Row label="Keeper saves" value={num(stats.keeperSavesAverage, 1)} />
                  <Row label="Fouls" value={num(stats.foulsAverage ?? 0, 1)} />
                  <Row
                    label="Cards"
                    value={
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-3 w-2 rounded-[1px] bg-card-yellow" />
                          {stats.yellowCards}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-3 w-2 rounded-[1px] bg-card-red" />
                          {stats.redCards}
                        </span>
                      </span>
                    }
                  />
                  <Row
                    label="Distance / match"
                    value={`${(stats.distanceCoveredAverage / 1000).toFixed(1)} km`}
                  />
                </Card>
              </section>
            </>
          )}

          <Suspense fallback={<SectionSkeleton title="Competitions" rows={5} />}>
            <TournamentsSection teamId={teamId} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

function SquadTable({ squad }: { squad: SquadEntry[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="label-xs px-4 py-2.5 text-left">Player</th>
              <th className="label-xs px-3 py-2.5 text-left">Role</th>
              <th className="label-xs px-3 py-2.5 text-center">Pos</th>
              <th className="label-xs px-3 py-2.5 text-center">Apps</th>
              <th className="label-xs px-3 py-2.5 text-center">G</th>
              <th className="label-xs px-3 py-2.5 text-center">A</th>
              <th className="label-xs px-3 py-2.5 text-right">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {squad.map((s, i) => {
              const p = s.playerTeam.player;
              const name = cleanName(p?.name) || p?.name || 'Unknown';
              return (
                <tr key={i} className="transition-colors hover:bg-white/[0.025]">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/players/${s.playerTeam.playerId}`}
                      className="flex items-center gap-2 transition-colors hover:text-turf-400"
                    >
                      <span className="max-w-[12rem] truncate font-medium text-chalk-100">
                        {name}
                      </span>
                      {p?.country && (
                        <span className="shrink-0 text-[10px] text-chalk-600">
                          {p.country.code}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <RoleTag role={s.playerTeam.teamRole} />
                  </td>
                  <td className="px-3 py-2.5 text-center text-[11px] font-bold text-chalk-500">
                    {s.position?.name ?? '–'}
                  </td>
                  <td className="tabular px-3 py-2.5 text-center text-chalk-300">
                    {s.appearances || '–'}
                  </td>
                  <td className="tabular px-3 py-2.5 text-center font-bold text-chalk-100">
                    {s.goals || '–'}
                  </td>
                  <td className="tabular px-3 py-2.5 text-center text-chalk-300">
                    {s.assists || '–'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-chalk-600">
                    {fmtDate(s.playerTeam.joinDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RoleTag({ role }: { role: number }) {
  const label = TEAM_ROLE_LABEL[role] ?? 'Player';
  const tone =
    role === 6
      ? 'bg-flare-500/12 text-flare-400'
      : role === 5
        ? 'bg-sky-500/12 text-sky-400'
        : 'text-chalk-500';
  return <span className={`rounded px-1.5 py-0.5 ${tone}`}>{label}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-chalk-500">{label}</span>
      <span className="tabular text-right text-[13px] font-medium text-chalk-200">
        {value}
      </span>
    </div>
  );
}


// ---------------------------------------------------------- streamed blocks

async function SquadSection({ teamId }: { teamId: number }) {
  const squad = await safe(getTeamSquad(teamId));
  const active = (squad ?? [])
    .filter((s) => s.playerTeam.isCurrentTeam)
    .sort(
      (a, b) =>
        b.playerTeam.teamRole - a.playerTeam.teamRole || b.appearances - a.appearances,
    );
  const shown = active.length > 0 ? active : (squad ?? []).slice(0, 30);

  return (
    <section>
      <SectionHeader title="Squad" subtitle={`${shown.length} players`} />
      {shown.length === 0 ? (
        <EmptyState title="No squad data available" icon="👥" />
      ) : (
        <SquadTable squad={shown} />
      )}
    </section>
  );
}

async function MatchesSection({ teamId }: { teamId: number }) {
  const [recent, upcoming] = await Promise.all([
    safe(
      getMatches({
        pageSize: 8,
        sortBy: 'KickOff',
        sortOrder: 'DESC',
        filters: { includePast: true, teamId },
      }),
    ),
    safe(
      getMatches({
        pageSize: 5,
        sortBy: 'KickOff',
        sortOrder: 'ASC',
        filters: { includeUpcoming: true, teamId },
      }),
    ),
  ]);

  return (
    <>
      {upcoming && upcoming.items.length > 0 && (
        <section>
          <SectionHeader title="Next fixtures" />
          <Card className="divide-y divide-[var(--line)] p-1">
            {upcoming.items.map((m) => (
              <MatchRow key={m.id} match={m} showDate />
            ))}
          </Card>
        </section>
      )}

      <section className="mt-8">
        <SectionHeader title="Recent results" subtitle="Latest completed matches" />
        {recent?.items.length ? (
          <Card className="divide-y divide-[var(--line)] p-1">
            {recent.items.map((m) => (
              <MatchRow key={m.id} match={m} showDate />
            ))}
          </Card>
        ) : (
          <EmptyState title="No matches recorded" />
        )}
      </section>
    </>
  );
}

async function TrendSection({ teamId }: { teamId: number }) {
  const [performance, activity] = await Promise.all([
    safe(getTeamPerformance(teamId, 'monthly')),
    safe(getTeamMatchTotals(teamId)),
  ]);

  return (
    <>
      {performance && performance.length > 1 && (
        <section>
          <SectionHeader title="Performance trend" subtitle="Monthly averages" />
          <Card className="p-4 sm:p-5">
            <PerformanceChart points={performance} />
          </Card>
        </section>
      )}
      {activity && activity.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Activity" subtitle="Matches played per day" />
          <Card className="p-4 sm:p-5">
            <ActivityStrip data={activity} />
          </Card>
        </section>
      )}
    </>
  );
}

async function TournamentsSection({ teamId }: { teamId: number }) {
  const tournaments = await safe(getTournamentsForTeam(teamId));
  if (!tournaments || tournaments.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Competitions" subtitle={`${tournaments.length} entered`} />
      <Card className="divide-y divide-[var(--line)]">
        {tournaments.slice(0, 10).map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-chalk-200">{t.name}</div>
              <div className="text-[11px] text-chalk-600">{fmtDate(t.startDate)}</div>
            </div>
            {t.winningTeamId === teamId && (
              <span className="shrink-0 text-sm" title="Winner">
                🏆
              </span>
            )}
          </Link>
        ))}
      </Card>
    </section>
  );
}

export function SectionSkeleton({ title, rows = 5 }: { title: string; rows?: number }) {
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
