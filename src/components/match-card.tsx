import Link from 'next/link';
import { Badge, FormRun, LiveDot } from '@/components/ui';
import { TeamBadge } from '@/components/team-badge';
import {
  fmtTime,
  mapLabel,
  matchScore,
  matchTypeLabel,
  relative,
  teamLabel,
} from '@/lib/format';
import type { Match } from '@/lib/types';

export function MatchRow({ match, showDate = false }: { match: Match; showDate?: boolean }) {
  const score = matchScore(match);
  const played = score !== null;
  const homeWon = score ? score.home > score.away : false;
  const awayWon = score ? score.away > score.home : false;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.035] sm:gap-4 sm:px-4"
    >
      <div className="w-12 shrink-0 sm:w-14">
        <div className="tabular text-[13px] font-medium text-chalk-300">
          {fmtTime(match.kickOff)}
        </div>
        {showDate && (
          <div className="mt-0.5 text-[10px] text-chalk-600">
            {new Date(match.kickOff).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            })}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <TeamSide
          team={match.teamHome}
          goals={score?.home}
          winner={homeWon}
          played={played}
        />
        <div className="mt-1.5" />
        <TeamSide
          team={match.teamAway}
          goals={score?.away}
          winner={awayWon}
          played={played}
        />
      </div>

      <div className="hidden w-32 shrink-0 flex-col items-end gap-1 sm:flex">
        {match.tournament ? (
          <span className="max-w-full truncate text-[11px] font-medium text-flare-500/80">
            {match.tournament.name}
          </span>
        ) : (
          <span className="text-[11px] text-chalk-600">{matchTypeLabel(match)}</span>
        )}
        {match.map && (
          <span className="max-w-full truncate text-[10px] text-chalk-600">
            {mapLabel(match.map.name)}
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 text-chalk-700 transition-all group-hover:translate-x-0.5 group-hover:text-chalk-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function TeamSide({
  team,
  goals,
  winner,
  played,
}: {
  team: Match['teamHome'];
  goals?: number;
  winner: boolean;
  played: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge team={team} size="sm" />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          !played
            ? 'font-medium text-chalk-300'
            : winner
              ? 'font-semibold text-chalk-100'
              : 'font-medium text-chalk-500'
        }`}
      >
        {teamLabel(team)}
      </span>
      {played && (
        <span
          className={`tabular w-6 shrink-0 text-right text-sm font-bold ${
            winner ? 'text-chalk-100' : 'text-chalk-500'
          }`}
        >
          {goals}
        </span>
      )}
    </div>
  );
}

/** Larger card used on the homepage and live page */
export function MatchCard({
  match,
  live,
  className = '',
}: {
  match: Match;
  live?: { home: number; away: number; period: string; clock: string };
  className?: string;
}) {
  const score = live ? { home: live.home, away: live.away } : matchScore(match);
  const upcoming = !score;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`surface group relative block overflow-hidden p-4 transition-all hover:border-[var(--line-strong)] hover:bg-white/[0.02] ${className}`}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {live ? (
            <Badge tone="live">
              <LiveDot />
              {live.period === 'WARM-UP' ? 'WARM-UP' : live.clock}
            </Badge>
          ) : upcoming ? (
            <Badge tone="info">{relative(match.kickOff)}</Badge>
          ) : (
            <Badge tone="muted">FT</Badge>
          )}
          {match.tournament && (
            <span className="truncate text-[11px] font-medium text-flare-500/85">
              {match.tournament.name}
            </span>
          )}
        </div>
        <span className="tabular shrink-0 text-[11px] text-chalk-600">
          {fmtTime(match.kickOff)}
        </span>
      </div>

      <div className="space-y-3">
        <BigSide
          team={match.teamHome}
          goals={score?.home}
          winner={!!score && score.home > score.away}
          dim={!!score && score.home < score.away}
        />
        <BigSide
          team={match.teamAway}
          goals={score?.away}
          winner={!!score && score.away > score.home}
          dim={!!score && score.away < score.home}
        />
      </div>

      {(match.teamHome?.form || match.teamAway?.form) && (
        <div className="mt-3.5 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <FormRun form={match.teamHome?.form} size="sm" max={5} />
          <span className="label-xs">form</span>
          <FormRun form={match.teamAway?.form} size="sm" max={5} />
        </div>
      )}
    </Link>
  );
}

function BigSide({
  team,
  goals,
  winner,
  dim,
}: {
  team: Match['teamHome'];
  goals?: number;
  winner: boolean;
  dim: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} size="md" />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${
          winner
            ? 'font-semibold text-chalk-100'
            : dim
              ? 'font-medium text-chalk-500'
              : 'font-medium text-chalk-200'
        }`}
      >
        {teamLabel(team)}
      </span>
      {goals != null && (
        <span
          className={`tabular font-display text-2xl font-bold ${
            dim ? 'text-chalk-600' : 'text-chalk-100'
          }`}
        >
          {goals}
        </span>
      )}
    </div>
  );
}
