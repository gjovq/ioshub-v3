import Link from 'next/link';
import { Suspense } from 'react';
import { CompareBar, SplitGauge } from '@/components/compare-bar';
import { ShotMap } from '@/components/shot-map';
import { TeamBadge } from '@/components/team-badge';
import { Badge, Card, EmptyState, LiveDot, SectionHeader } from '@/components/ui';
import { getLiveScore, getPlayerOfTheMatch, safe } from '@/lib/api';
import { loadMatch, requireEntity } from '@/lib/entities';
import { BODY_PART_LABEL, POSITION_GROUP_LABEL } from '@/lib/enums';
import {
  clock,
  fmtDateTime,
  mapLabel,
  matchScore,
  matchTypeLabel,
  pct,
  readableOn,
  safeColor,
  teamLabel,
} from '@/lib/format';
import {
  buildLiveTimeline,
  buildTimeline,
  liveSummary,
  playersBySide,
  shotEvents,
  teamTotals,
  topPerformers,
  type SidePlayer,
  type TimelineEvent,
} from '@/lib/match-analysis';
import type { LiveScoreState } from '@/lib/types';
import { connectLink, serverEndpointFromToken, serverPassword } from '@/lib/servers';
import type { Match } from '@/lib/types';

export const revalidate = 120;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const match = await loadMatch(Number(id));
  if (!match) return { title: 'Match not found' };
  const s = matchScore(match);
  const title = `${teamLabel(match.teamHome)} ${s ? `${s.home}–${s.away}` : 'v'} ${teamLabel(match.teamAway)}`;
  return { title };
}

export default async function MatchPage({ params }: { params: Params }) {
  const { id } = await params;
  const matchId = Number(id);
  const match = await requireEntity(loadMatch(matchId));

  const potm = match.playerOfTheMatchId ? await safe(getPlayerOfTheMatch(matchId)) : null;
  const md = match.matchStatistics?.matchData ?? null;
  const score = matchScore(match);
  const live = md ? null : await safe(getLiveScore(matchId));

  const homeColor = safeColor(match.teamHome?.color, '#2563eb');
  const awayColor = safeColor(match.teamAway?.color, '#dc2626');
  const distinct = homeColor.toLowerCase() !== awayColor.toLowerCase();
  const awayC = distinct ? awayColor : '#dc2626';

  const totals = md ? teamTotals(md) : null;
  const squads = md ? playersBySide(md) : null;
  const timeline = md ? buildTimeline(md) : [];
  const shots = md ? shotEvents(md) : [];
  const stars = md ? topPerformers(md, 3) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs match={match} />

      <Scoreboard
        match={match}
        score={score}
        live={live?.item2 ?? null}
        homeColor={homeColor}
        awayColor={awayC}
        timeline={timeline}
      />

      {!md ? (
        <div className="mt-8 space-y-8">
          {live?.item2 && (
            <Suspense fallback={null}>
              <LivePanel
                match={match}
                state={live.item2}
                homeColor={homeColor}
                awayColor={awayC}
              />
            </Suspense>
          )}
          {!live?.item2 && (
            <EmptyState
              title="No detailed statistics for this match"
              hint={
                score
                  ? 'The scoreline is recorded but the server never uploaded a full match file.'
                  : 'This match has not been played yet. Detailed stats appear after the final whistle.'
              }
              icon="📊"
            />
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-8">
            {timeline.length > 0 && (
              <section>
                <SectionHeader title="Timeline" subtitle="Goals and cards" />
                <Card className="p-4 sm:p-5">
                  <Timeline
                    events={timeline}
                    homeColor={homeColor}
                    awayColor={awayC}
                  />
                </Card>
              </section>
            )}

            {totals?.home && totals?.away && (
              <section>
                <SectionHeader title="Team comparison" subtitle="Full match totals" />
                <Card className="p-4 sm:p-6">
                  <SplitGauge
                    caption="Possession"
                    homeLabel={teamLabel(match.teamHome)}
                    awayLabel={teamLabel(match.teamAway)}
                    homeValue={totals.home.possession}
                    awayValue={totals.away.possession}
                    homeColor={homeColor}
                    awayColor={awayC}
                  />
                  <div className="mt-5 divide-y divide-[var(--line)]">
                    <CompareBar
                      label="Shots"
                      home={totals.home.shots}
                      away={totals.away.shots}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="On target"
                      home={totals.home.shotsOnGoal}
                      away={totals.away.shotsOnGoal}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="Passes"
                      home={totals.home.passes}
                      away={totals.away.passes}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="Pass accuracy"
                      home={totals.home.passAccuracy * 100}
                      away={totals.away.passAccuracy * 100}
                      homeColor={homeColor}
                      awayColor={awayC}
                      format={(v) => `${v.toFixed(0)}%`}
                    />
                    <CompareBar
                      label="Interceptions"
                      home={totals.home.interceptions}
                      away={totals.away.interceptions}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="Saves"
                      home={totals.home.keeperSaves}
                      away={totals.away.keeperSaves}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="Corners"
                      home={totals.home.corners}
                      away={totals.away.corners}
                      homeColor={homeColor}
                      awayColor={awayC}
                    />
                    <CompareBar
                      label="Fouls"
                      home={totals.home.fouls}
                      away={totals.away.fouls}
                      homeColor={homeColor}
                      awayColor={awayC}
                      invert
                    />
                    <CompareBar
                      label="Offsides"
                      home={totals.home.offsides}
                      away={totals.away.offsides}
                      homeColor={homeColor}
                      awayColor={awayC}
                      invert
                    />
                    <CompareBar
                      label="Distance (km)"
                      home={totals.home.distance / 1000}
                      away={totals.away.distance / 1000}
                      homeColor={homeColor}
                      awayColor={awayC}
                      format={(v) => v.toFixed(1)}
                    />
                  </div>
                </Card>
              </section>
            )}

            {squads && (
              <section>
                <SectionHeader
                  title="Player statistics"
                  subtitle="Per-player match totals"
                />
                <div className="space-y-4">
                  <SquadTable
                    title={teamLabel(match.teamHome)}
                    color={homeColor}
                    players={squads.home}
                    teamId={match.teamHomeId}
                  />
                  <SquadTable
                    title={teamLabel(match.teamAway)}
                    color={awayC}
                    players={squads.away}
                    teamId={match.teamAwayId}
                  />
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            {potm && (
              <section>
                <SectionHeader title="Player of the match" />
                <Card className="relative overflow-hidden p-5">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-flare-500/10 blur-2xl" />
                  <div className="relative">
                    <Badge tone="warn">★ Star man</Badge>
                    <Link
                      href={`/players/${potm.playerId}`}
                      className="mt-3 block font-display text-xl font-bold text-chalk-100 transition-colors hover:text-flare-400"
                    >
                      {potm.playerName}
                    </Link>
                    <p className="mt-0.5 text-xs text-chalk-500">
                      {POSITION_GROUP_LABEL[potm.positionGroup] ?? 'Player'}
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat label="Goals" value={potm.goals} />
                      <MiniStat label="Assists" value={potm.assists} />
                      <MiniStat label="Interceptions" value={potm.interceptions} />
                      <MiniStat label="Pass %" value={`${potm.passCompletion}%`} />
                      {potm.keeperSaves > 0 && (
                        <MiniStat label="Saves" value={potm.keeperSaves} />
                      )}
                      {potm.goalsConceded > 0 && (
                        <MiniStat label="Conceded" value={potm.goalsConceded} />
                      )}
                    </dl>
                  </div>
                </Card>
              </section>
            )}

            {stars.length > 0 && (
              <section>
                <SectionHeader title="Standout performers" />
                <Card className="divide-y divide-[var(--line)]">
                  {stars.map((p) => (
                    <div key={p.steamId64} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ background: p.side === 'home' ? homeColor : awayC }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-chalk-100">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-chalk-600">
                          {p.position} ·{' '}
                          {[
                            p.goals > 0 && `${p.goals}G`,
                            p.assists > 0 && `${p.assists}A`,
                            p.keeperSaves > 0 && `${p.keeperSaves} saves`,
                            p.interceptions > 0 && `${p.interceptions} int`,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Squad player'}
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {shots.length > 0 && md && (
              <section>
                <SectionHeader title="Shot map" subtitle={`${shots.length} attempts`} />
                <Card className="p-4">
                  <ShotMap
                    shots={shots}
                    fieldMin={md.matchInfo.fieldMin}
                    fieldMax={md.matchInfo.fieldMax}
                    homeColor={homeColor}
                    awayColor={awayC}
                    homeName={teamLabel(match.teamHome)}
                    awayName={teamLabel(match.teamAway)}
                  />
                </Card>
              </section>
            )}

            <section>
              <SectionHeader title="Match info" />
              <Card className="divide-y divide-[var(--line)] text-sm">
                <InfoRow label="Kick-off" value={fmtDateTime(match.kickOff)} />
                <InfoRow label="Type" value={matchTypeLabel(match)} />
                <InfoRow label="Format" value={`${match.format}v${match.format}`} />
                {match.map && <InfoRow label="Stadium" value={mapLabel(match.map.name)} />}
                {md?.matchInfo.serverName && (
                  <InfoRow label="Server" value={md.matchInfo.serverName} />
                )}
                {md && (
                  <InfoRow
                    label="Duration"
                    value={clock(md.matchInfo.endTime - md.matchInfo.startTime)}
                  />
                )}
                {match.tournament && (
                  <InfoRow
                    label="Competition"
                    value={
                      <Link
                        href={`/tournaments/${match.tournament.id}`}
                        className="text-flare-400 hover:underline"
                      >
                        {match.tournament.name}
                      </Link>
                    }
                  />
                )}
              </Card>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({ match }: { match: Match }) {
  return (
    <nav className="mb-5 flex items-center gap-1.5 text-xs text-chalk-600">
      <Link href="/matches" className="transition-colors hover:text-chalk-300">
        Matches
      </Link>
      <span>/</span>
      <span className="text-chalk-500">#{match.id}</span>
    </nav>
  );
}

function Scoreboard({
  match,
  score,
  live,
  homeColor,
  awayColor,
  timeline,
}: {
  match: Match;
  score: { home: number; away: number } | null;
  live: LiveScoreState | null;
  homeColor: string;
  awayColor: string;
  timeline: TimelineEvent[];
}) {
  const scorers = (side: 'home' | 'away') =>
    timeline.filter(
      (e) =>
        (e.event === 'GOAL' && e.team === side) ||
        (e.event === 'OWN GOAL' && e.team !== side),
    );

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }}
      />
      <div className="p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {live && (
            <Badge tone="live">
              <LiveDot />
              <span className="tabular">{clock(live.matchSeconds)}</span>
              <span className="opacity-70">{live.matchPeriod.replace(' HALF', '')}</span>
            </Badge>
          )}
          {match.tournament ? (
            <Link href={`/tournaments/${match.tournament.id}`}>
              <Badge tone="warn">{match.tournament.name}</Badge>
            </Link>
          ) : (
            <Badge tone="muted">{matchTypeLabel(match)}</Badge>
          )}
          <Badge tone="neutral">{match.format}v{match.format}</Badge>
          {match.map && <Badge tone="muted">{mapLabel(match.map.name)}</Badge>}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <SideBlock team={match.teamHome} align="right" color={homeColor} />

          <div className="text-center">
            {live ? (
              <div className="tabular font-display text-4xl font-bold tracking-tight text-chalk-100 sm:text-6xl">
                {live.matchGoalsHome}
                <span className="mx-2 text-chalk-700 sm:mx-3">–</span>
                {live.matchGoalsAway}
              </div>
            ) : score ? (
              <div className="tabular font-display text-4xl font-bold tracking-tight text-chalk-100 sm:text-6xl">
                {score.home}
                <span className="mx-2 text-chalk-700 sm:mx-3">–</span>
                {score.away}
              </div>
            ) : (
              <div className="font-display text-2xl font-bold text-chalk-500 sm:text-4xl">
                vs
              </div>
            )}
            <div className="mt-2 text-[11px] font-medium text-chalk-600">
              {fmtDateTime(match.kickOff)}
            </div>
          </div>

          <SideBlock team={match.teamAway} align="left" color={awayColor} />
        </div>

        {timeline.some((e) => e.event === 'GOAL' || e.event === 'OWN GOAL') && (
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4 text-xs">
            <ScorerList events={scorers('home')} align="right" />
            <ScorerList events={scorers('away')} align="left" />
          </div>
        )}
      </div>
    </Card>
  );
}

function SideBlock({
  team,
  align,
  color,
}: {
  team: Match['teamHome'];
  align: 'left' | 'right';
  color: string;
}) {
  const right = align === 'right';
  const body = (
    <div
      className={`flex min-w-0 flex-col items-center gap-2.5 sm:flex-row sm:gap-4 ${
        right ? 'sm:flex-row-reverse sm:text-right' : ''
      }`}
    >
      <TeamBadge team={team} size="xl" className="hidden sm:block" />
      <TeamBadge team={team} size="lg" className="sm:hidden" />
      <div className="min-w-0">
        <div className="line-clamp-2 font-display text-sm font-bold leading-tight text-chalk-100 sm:text-xl">
          {teamLabel(team)}
        </div>
        {team?.teamCode && (
          <div
            className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ background: `${color}22`, color: readableOn(color) }}
          >
            {team.teamCode}
          </div>
        )}
      </div>
    </div>
  );

  if (!team) return body;
  return (
    <Link
      href={`/teams/${team.id}`}
      className="min-w-0 transition-opacity hover:opacity-80"
    >
      {body}
    </Link>
  );
}

function ScorerList({
  events,
  align,
}: {
  events: TimelineEvent[];
  align: 'left' | 'right';
}) {
  if (events.length === 0) return <div />;
  return (
    <ul className={`space-y-1 ${align === 'right' ? 'text-right' : ''}`}>
      {events.map((e, i) => (
        <li key={i} className="truncate text-chalk-400">
          <span className="text-chalk-200">{e.playerName ?? 'Unknown'}</span>
          <span className="tabular ml-1.5 text-chalk-600">{e.minute}&apos;</span>
          {e.event === 'OWN GOAL' && (
            <span className="ml-1 text-[10px] text-red-400/80">OG</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Timeline({
  events,
  homeColor,
  awayColor,
}: {
  events: TimelineEvent[];
  homeColor: string;
  awayColor: string;
}) {
  return (
    <ol className="relative space-y-1">
      <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-[var(--line)]" />
      {events.map((e, i) => {
        const home = e.team === 'home';
        const color = home ? homeColor : awayColor;
        return (
          <li
            key={i}
            className={`relative flex items-center gap-3 ${home ? '' : 'flex-row-reverse'}`}
          >
            <div className={`flex-1 ${home ? 'text-right' : 'text-left'}`}>
              <div className="flex items-center gap-2" style={{ flexDirection: home ? 'row-reverse' : 'row' }}>
                <span className="shrink-0">{eventIcon(e.event)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-chalk-200">
                    {e.playerName ?? 'Unknown'}
                  </div>
                  {e.assistName && e.event === 'GOAL' && (
                    <div className="truncate text-[11px] text-chalk-600">
                      assist {e.assistName}
                    </div>
                  )}
                  {e.event === 'OWN GOAL' && (
                    <div className="text-[11px] text-red-400/80">own goal</div>
                  )}
                  {e.bodyPart > 0 && (
                    <div className="text-[10px] text-chalk-600">
                      {BODY_PART_LABEL[e.bodyPart]}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="relative z-10 flex w-14 shrink-0 justify-center">
              <span
                className="tabular rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                style={{ background: `${color}1f`, color: readableOn(color) }}
              >
                {e.minute}&apos;
              </span>
            </div>

            <div className="flex-1 text-[11px] text-chalk-600">
              {(e.event === 'GOAL' || e.event === 'OWN GOAL') && (
                <span className={`tabular ${home ? 'text-left' : 'text-right block'}`}>
                  {e.scoreHome}–{e.scoreAway}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function eventIcon(event: string) {
  if (event === 'GOAL')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-turf-500/15 text-[10px]">
        ⚽
      </span>
    );
  if (event === 'OWN GOAL')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-[10px]">
        ⚽
      </span>
    );
  if (event === 'YELLOW CARD')
    return <span className="block h-4 w-3 rounded-[2px] bg-card-yellow" />;
  if (event === 'SECOND YELLOW' || event === 'RED CARD')
    return <span className="block h-4 w-3 rounded-[2px] bg-card-red" />;
  return <span className="block h-2 w-2 rounded-full bg-chalk-600" />;
}

function SquadTable({
  title,
  color,
  players,
  teamId,
}: {
  title: string;
  color: string;
  players: SidePlayer[];
  teamId: number | null;
}) {
  if (players.length === 0) return null;
  const showKeeper = players.some((p) => p.keeperSaves > 0 || p.positionGroup === 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
        <span className="h-4 w-1 rounded-full" style={{ background: color }} />
        {teamId ? (
          <Link
            href={`/teams/${teamId}`}
            className="font-display text-sm font-bold text-chalk-100 hover:text-turf-400"
          >
            {title}
          </Link>
        ) : (
          <span className="font-display text-sm font-bold text-chalk-100">{title}</span>
        )}
        <span className="ml-auto text-[11px] text-chalk-600">{players.length} players</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left">
              <Th className="w-8">#</Th>
              <Th>Player</Th>
              <Th align="center">G</Th>
              <Th align="center">A</Th>
              <Th align="center">Sh</Th>
              <Th align="center">Pass</Th>
              <Th align="center">Int</Th>
              {showKeeper && <Th align="center">Sv</Th>}
              <Th align="center">Km</Th>
              <Th align="center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {players.map((p) => (
              <tr key={p.steamId64} className="transition-colors hover:bg-white/[0.02]">
                <Td className="text-[10px] font-bold text-chalk-600">{p.position}</Td>
                <Td className="max-w-[10rem] truncate font-medium text-chalk-200">
                  {p.name}
                </Td>
                <Td align="center" strong={p.goals > 0}>
                  {p.goals || '–'}
                </Td>
                <Td align="center" strong={p.assists > 0}>
                  {p.assists || '–'}
                </Td>
                <Td align="center">
                  {p.shots ? `${p.shotsOnGoal}/${p.shots}` : '–'}
                </Td>
                <Td align="center">
                  {p.passes ? (
                    <span title={`${p.passesCompleted}/${p.passes}`}>
                      {pct(p.passAccuracy)}
                    </span>
                  ) : (
                    '–'
                  )}
                </Td>
                <Td align="center">{p.interceptions || '–'}</Td>
                {showKeeper && <Td align="center">{p.keeperSaves || '–'}</Td>}
                <Td align="center" className="text-chalk-500">
                  {(p.distance / 1000).toFixed(1)}
                </Td>
                <Td align="center">
                  <span className="flex items-center justify-center gap-0.5">
                    {p.yellowCards > 0 && (
                      <span className="h-3 w-2 rounded-[1px] bg-card-yellow" title="Yellow card" />
                    )}
                    {p.redCards > 0 && (
                      <span className="h-3 w-2 rounded-[1px] bg-card-red" title="Red card" />
                    )}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({
  children,
  align = 'left',
  className = '',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <th
      className={`label-xs px-3 py-2 font-semibold ${align === 'center' ? 'text-center' : ''} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
  strong = false,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  strong?: boolean;
}) {
  return (
    <td
      className={`tabular px-3 py-2 ${align === 'center' ? 'text-center' : ''} ${
        strong ? 'font-bold text-chalk-100' : 'text-chalk-400'
      } ${className}`}
    >
      {children}
    </td>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-lg font-bold text-chalk-100">
        {value}
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="label-xs shrink-0 pt-0.5">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-chalk-300">{value}</span>
    </div>
  );
}

function LivePanel({
  match,
  state,
  homeColor,
  awayColor,
}: {
  match: Match;
  state: NonNullable<Awaited<ReturnType<typeof getLiveScore>>>['item2'];
  homeColor: string;
  awayColor: string;
}) {
  const endpoint = serverEndpointFromToken(state.matchDataToken);
  const password = serverPassword(match.server?.name);
  const warmup = state.matchPeriod === 'WARM-UP';
  const liveTimeline = buildLiveTimeline(state.matchEvents);
  const summary = liveSummary(state.matchEvents);
  const liveShots = (state.matchEvents ?? []).filter(
    (e) =>
      ['GOAL', 'MISS', 'SAVE', 'OWN GOAL'].includes(e.event) && e.startPosition != null,
  );
  const flag = match.server?.country?.discordFlagEmote;

  return (
    <section>
      <SectionHeader
        title="Live statistics"
        subtitle={
          warmup
            ? 'Warm-up · kick-off imminent'
            : `${state.serverPlayerCount} players on the server`
        }
      />
      <Card className="divide-y divide-[var(--line)]">
        {!warmup && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-4">
            <SummaryStat
              label="Shots"
              home={summary.home.attempts}
              away={summary.away.attempts}
              homeColor={homeColor}
              awayColor={awayColor}
            />
            <SummaryStat
              label="On target"
              home={summary.home.onTarget}
              away={summary.away.onTarget}
              homeColor={homeColor}
              awayColor={awayColor}
            />
            <SummaryStat
              label="Saves"
              home={summary.home.saves}
              away={summary.away.saves}
              homeColor={homeColor}
              awayColor={awayColor}
            />
            <SummaryStat
              label="Cards"
              home={summary.home.cards}
              away={summary.away.cards}
              homeColor={homeColor}
              awayColor={awayColor}
            />
          </div>
        )}

        {liveTimeline.length > 0 && (
          <div className="p-4 sm:p-5">
            <Timeline events={liveTimeline} homeColor={homeColor} awayColor={awayColor} />
          </div>
        )}

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Lineup title={state.teamNameHome} color={homeColor} rows={state.teamLineupHome} />
          <Lineup title={state.teamNameAway} color={awayColor} rows={state.teamLineupAway} />
        </div>

        {liveShots.length > 0 && (
          <div className="p-4">
            <ShotMap
              shots={liveShots.map((e) => ({
                ...e,
                playerName: e.player1Name ?? 'Unknown',
                isGoal: e.event === 'GOAL',
                minute: Math.max(1, Math.round(e.second / 60)),
                bodyPart: e.bodyPart,
              }))}
              // standard engine pitch; live events carry no field bounds
              fieldMin={{ x: -1554, y: -2406 }}
              fieldMax={{ x: 1554, y: 2406 }}
              homeColor={homeColor}
              awayColor={awayColor}
              homeName={state.teamNameHome}
              awayName={state.teamNameAway}
            />
          </div>
        )}

        {endpoint && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <div className="label-xs">Server</div>
              <div className="truncate text-[13px] text-chalk-300">
                {flag ? `${flag} ` : ''}
                {match.server?.name ?? endpoint}
              </div>
            </div>
            <a
              href={connectLink(endpoint)}
              title={`Password: ${password}`}
              className="shrink-0 rounded-lg bg-turf-500/15 px-3 py-1.5 text-xs font-semibold text-turf-400 ring-1 ring-inset ring-turf-500/25 transition-colors hover:bg-turf-500/25"
            >
              Connect to server
            </a>
          </div>
        )}
      </Card>
    </section>
  );
}

function Lineup({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: { position: string; name: string | null; steamId: string | null }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-1 rounded-full" style={{ background: color }} />
        <span className="truncate font-display text-xs font-bold uppercase tracking-wider text-chalk-300">
          {title}
        </span>
      </div>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="tabular w-8 shrink-0 text-[10px] font-bold text-chalk-600">
              {r.position}
            </span>
            <span
              className={`min-w-0 flex-1 truncate ${
                r.name
                  ? 'text-chalk-300'
                  : 'text-chalk-700 italic'
              }`}
            >
              {r.name ?? 'Unknown'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryStat({
  label,
  home,
  away,
  homeColor,
  awayColor,
}: {
  label: string;
  home: number;
  away: number;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div className="text-center">
      <div className="label-xs">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-2 text-sm">
        <span className="tabular font-semibold" style={{ color: homeColor }}>
          {home}
        </span>
        <span className="text-chalk-600">–</span>
        <span className="tabular font-semibold" style={{ color: awayColor }}>
          {away}
        </span>
      </div>
    </div>
  );
}
