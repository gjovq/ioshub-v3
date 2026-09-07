import { Suspense } from 'react';
import Link from 'next/link';
import { ActivityStrip, PerformanceChart, ResultsBar } from '@/components/charts';
import { RatingHistoryChart } from '@/components/rating-history-chart';
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
import { RatingChip } from '@/app/players/page';
import { loadPlayer, requireEntity } from '@/lib/entities';
import {
  getPlayerAggregate,
  getPlayerAppearanceTotals,
  getPlayerPerformance,
  getPlayerTeamHistory,
  getTournamentsForPlayer,
  safe,
} from '@/lib/api';
import { DONATOR_LABEL, HUB_ROLE_LABEL, TEAM_ROLE_LABEL } from '@/lib/enums';
import {
  cleanName,
  compact,
  duration,
  fmtDate,
  num,
  pct,
  teamLabel,
} from '@/lib/format';
import type { SquadEntry } from '@/lib/types';
import { configuredRatingStore } from '@/lib/rating-history';

export const revalidate = 300;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const p = await loadPlayer(Number(id));
  return { title: p ? cleanName(p.name) || `Player ${id}` : 'Player not found' };
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const playerId = Number(id);
  const player = await requireEntity(loadPlayer(playerId));

  const [stats, history] = await Promise.all([
    safe(getPlayerAggregate(playerId)),
    safe(getPlayerTeamHistory(playerId)),
  ]);

  const sorted = [...(history ?? [])].sort(
    (a, b) =>
      new Date(b.playerTeam.joinDate ?? 0).getTime() -
      new Date(a.playerTeam.joinDate ?? 0).getTime(),
  );
  const currentTeams = sorted.filter((h) => h.playerTeam.isCurrentTeam);
  const pastTeams = sorted.filter((h) => !h.playerTeam.isCurrentTeam);

  const name = cleanName(player.name) || player.name;
  const totals = aggregate(history ?? []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-chalk-600">
        <Link href="/players" className="transition-colors hover:text-chalk-300">
          Players
        </Link>
        <span>/</span>
        <span className="text-chalk-500">{name}</span>
      </nav>

      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-turf-500/[0.07] blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pitch-600 to-pitch-800 font-display text-2xl font-bold text-chalk-200 ring-1 ring-inset ring-white/10 sm:h-20 sm:w-20 sm:text-3xl">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
                {name}
              </h1>
              {player.rating != null && player.rating > 0 && (
                <RatingChip value={player.rating} />
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {player.country && <Badge tone="neutral">{player.country.name}</Badge>}
              {player.hubRole > 0 && (
                <Badge tone="info">{HUB_ROLE_LABEL[player.hubRole] ?? 'Staff'}</Badge>
              )}
              {player.donatorLevel > 0 && (
                <Badge tone="warn">{DONATOR_LABEL[player.donatorLevel]} donator</Badge>
              )}
              {currentTeams.slice(0, 3).map((t) => (
                <Link key={t.playerTeam.team?.id} href={`/teams/${t.playerTeam.team?.id}`}>
                  <Badge tone="success">
                    {teamLabel(t.playerTeam.team)}
                    <span className="opacity-60">
                      {TEAM_ROLE_LABEL[t.playerTeam.teamRole] ?? ''}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-chalk-600">
              On the hub since {fmtDate(player.createdDate)}
              {stats && ` · ${duration(stats.secondsPlayed)} on the pitch`}
            </p>
          </div>
        </div>
      </Card>

      {stats ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Appearances" value={num(stats.appearances)} sub={`${num(stats.substituteAppearances)} as sub`} />
          <Stat label="Goals" value={num(stats.goals)} sub={`${stats.goalsAverage.toFixed(2)} per match`} accent />
          <Stat label="Assists" value={num(stats.assists)} sub={`${stats.assistsAverage.toFixed(2)} per match`} />
          <Stat label="Pass accuracy" value={pct(stats.passCompletionPercentageAverage)} sub={`${compact(stats.passesCompleted)} completed`} />
          <Stat label="Interceptions" value={compact(stats.interceptions)} sub={`${stats.interceptionsAverage.toFixed(1)} per match`} />
          <Stat label="Win rate" value={pct(stats.winPercentage)} sub={`${stats.wins}W ${stats.draws}D ${stats.losses}L`} />
        </div>
      ) : (
        totals && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Appearances" value={num(totals.appearances)} />
            <Stat label="Goals" value={num(totals.goals)} accent />
            <Stat label="Assists" value={num(totals.assists)} />
            <Stat label="Clubs" value={num((history ?? []).length)} />
          </div>
        )
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Suspense fallback={<SectionSkeleton title="Form over time" rows={3} />}>
            <TrendSection playerId={playerId} />
          </Suspense>

          <section>
            <SectionHeader
              title="Club history"
              subtitle={`${(history ?? []).length} spells recorded`}
            />
            {sorted.length === 0 ? (
              <EmptyState title="No club history recorded" icon="🛡️" />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--line)]">
                        <th className="label-xs px-4 py-2.5 text-left">Club</th>
                        <th className="label-xs px-3 py-2.5 text-left">Role</th>
                        <th className="label-xs px-3 py-2.5 text-center">Apps</th>
                        <th className="label-xs px-3 py-2.5 text-center">G</th>
                        <th className="label-xs px-3 py-2.5 text-center">A</th>
                        <th className="label-xs px-3 py-2.5 text-left">Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {sorted.map((h, i) => (
                        <tr key={i} className="transition-colors hover:bg-white/[0.025]">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <TeamBadge team={h.playerTeam.team} size="sm" />
                              <Link
                                href={`/teams/${h.playerTeam.team?.id}`}
                                className="max-w-[12rem] truncate font-medium text-chalk-200 transition-colors hover:text-turf-400"
                              >
                                {teamLabel(h.playerTeam.team)}
                              </Link>
                              {h.playerTeam.isCurrentTeam && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-turf-500" title="Current club" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-chalk-500">
                            {TEAM_ROLE_LABEL[h.playerTeam.teamRole] ?? '–'}
                          </td>
                          <td className="tabular px-3 py-2.5 text-center text-chalk-300">
                            {h.appearances || '–'}
                          </td>
                          <td className="tabular px-3 py-2.5 text-center font-bold text-chalk-100">
                            {h.goals || '–'}
                          </td>
                          <td className="tabular px-3 py-2.5 text-center text-chalk-300">
                            {h.assists || '–'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-chalk-600">
                            {fmtDate(h.playerTeam.joinDate)}
                            {h.playerTeam.leaveDate
                              ? ` – ${fmtDate(h.playerTeam.leaveDate)}`
                              : ' – now'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>


        </div>

        <aside className="space-y-6">
          {stats && (
            <section>
              <SectionHeader title="Results" />
              <Card className="p-5">
                <ResultsBar wins={stats.wins} draws={stats.draws} losses={stats.losses} />
                <div className="mt-4 space-y-2.5 border-t border-[var(--line)] pt-4 text-sm">
                  <Row label="Shots" value={`${num(stats.shotsOnGoal)} / ${num(stats.shots)} on target`} />
                  <Row label="Shot conversion" value={pct(stats.shotConversionPercentage)} />
                  <Row label="Chances created" value={num(stats.chancesCreated)} />
                  <Row label="Key passes" value={num(stats.keyPasses)} />
                  {stats.keeperSaves > 0 && (
                    <Row label="Keeper saves" value={num(stats.keeperSaves)} />
                  )}
                  <Row label="Goals conceded" value={num(stats.goalsConceded)} />
                  <Row label="Fouls" value={`${num(stats.fouls)} made / ${num(stats.foulsSuffered)} won`} />
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
                  <Row label="Distance / match" value={`${(stats.distanceCoveredAverage / 1000).toFixed(2)} km`} />
                </div>
              </Card>
            </section>
          )}

          {currentTeams.length > 0 && (
            <section>
              <SectionHeader title="Current clubs" />
              <Card className="divide-y divide-[var(--line)]">
                {currentTeams.map((t, i) => (
                  <Link
                    key={i}
                    href={`/teams/${t.playerTeam.team?.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <TeamBadge team={t.playerTeam.team} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-chalk-200">
                        {teamLabel(t.playerTeam.team)}
                      </div>
                      <div className="text-[11px] text-chalk-600">
                        {TEAM_ROLE_LABEL[t.playerTeam.teamRole] ?? 'Player'} · joined{' '}
                        {fmtDate(t.playerTeam.joinDate)}
                      </div>
                    </div>
                    <FormRun form={t.playerTeam.team?.form} size="sm" max={3} />
                  </Link>
                ))}
              </Card>
            </section>
          )}

          <Suspense fallback={<SectionSkeleton title="Competitions" rows={5} />}>
            <CompetitionsSection playerId={playerId} />
          </Suspense>

          {pastTeams.length > 0 && (
            <section>
              <SectionHeader title="Former clubs" subtitle={`${pastTeams.length}`} />
              <Card className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {pastTeams.slice(0, 24).map((t, i) => (
                    <Link
                      key={i}
                      href={`/teams/${t.playerTeam.team?.id}`}
                      className="rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-chalk-400 transition-colors hover:bg-white/[0.08] hover:text-chalk-200"
                    >
                      {teamLabel(t.playerTeam.team)}
                    </Link>
                  ))}
                </div>
              </Card>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function aggregate(history: SquadEntry[]) {
  if (history.length === 0) return null;
  return history.reduce(
    (acc, h) => ({
      appearances: acc.appearances + (h.appearances || 0),
      goals: acc.goals + (h.goals || 0),
      assists: acc.assists + (h.assists || 0),
    }),
    { appearances: 0, goals: 0, assists: 0 },
  );
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

async function TrendSection({ playerId }: { playerId: number }) {
  const [performance, appearances] = await Promise.all([
    safe(getPlayerPerformance(playerId, 'monthly')),
    safe(getPlayerAppearanceTotals(playerId)),
  ]);
  const ratingHistory = await configuredRatingStore()?.list(playerId) ?? [];

  return (
    <>
      {performance && performance.length > 1 && (
        <section>
          <SectionHeader title="Form over time" subtitle="Monthly averages" />
          <Card className="p-4 sm:p-5">
            <PerformanceChart points={performance} />
          </Card>
        </section>
      )}
      {appearances && appearances.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Activity" subtitle="Matches played per day" />
          <Card className="p-4 sm:p-5">
            <ActivityStrip data={appearances} />
          </Card>
        </section>
      )}
      {ratingHistory.length > 1 && (
        <section className="mt-8">
          <SectionHeader title="Rating history" subtitle="Stored observations" />
          <Card className="p-4 sm:p-5"><RatingHistoryChart points={ratingHistory} /></Card>
        </section>
      )}
    </>
  );
}

async function CompetitionsSection({ playerId }: { playerId: number }) {
  const tournaments = await safe(getTournamentsForPlayer(playerId));
  if (!tournaments || tournaments.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Competitions" subtitle={`${tournaments.length} entered`} />
      <Card className="divide-y divide-[var(--line)]">
        {tournaments.slice(0, 8).map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="block px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
          >
            <div className="truncate text-sm font-medium text-chalk-200">{t.name}</div>
            <div className="text-[11px] text-chalk-600">{fmtDate(t.startDate)}</div>
          </Link>
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
