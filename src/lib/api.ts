import { createLimiter, withRetry } from './limiter';
import { parseLiveServerSnapshot } from './live-server';
import type {
  AppearanceTotal,
  Country,
  LiveScoreEntry,
  LiveServerSnapshot,
  Match,
  MatchFilters,
  Paged,
  PerformancePoint,
  Player,
  PlayerOfTheMatch,
  PlayerStatistics,
  Region,
  SquadEntry,
  Standing,
  StatFilters,
  Team,
  TeamStatistics,
  Tournament,
  TournamentGroup,
} from './types';

export const API_ORIGIN = 'https://iosoccer.com:44380';

const UA = 'iosoccer-hub/1.0 (+read-only public data viewer)';

/** The upstream service degrades under parallel statistics queries. */
const limit = createLimiter(6, 60);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchOpts = {
  /** seconds of ISR cache; 0 disables caching */
  revalidate?: number;
  body?: unknown;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
  /** Retrying an already-slow aggregate only doubles upstream load. */
  retry?: boolean;
};

/**
 * Raw call against the upstream API. Never follows redirects: a 302 means the
 * route sits behind auth and would otherwise return an HTML login page.
 */
async function call<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const {
    revalidate = 300,
    body,
    method = body ? 'POST' : 'GET',
    timeoutMs = 20000,
    retry = true,
  } = opts;
  const url = `${API_ORIGIN}${path}`;

  const doFetch = async (): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': UA,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        next: revalidate > 0 ? { revalidate } : undefined,
        cache: revalidate > 0 ? undefined : 'no-store',
      });

      if (res.status === 302 || res.status === 301) {
        throw new ApiError('Endpoint requires authentication', 401, path);
      }
      if (!res.ok) {
        throw new ApiError(`Upstream returned ${res.status}`, res.status, path);
      }

      const text = await res.text();
      if (!text) return null as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError('Upstream returned non-JSON', 502, path);
      }
    } finally {
      clearTimeout(timer);
    }
  };

  return limit(() => withRetry(doFetch, { attempts: retry ? 1 : 0 }));
}

/** Resolves to null instead of throwing, so one dead widget can't blank a page. */
export async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- reference

export const getRegions = () => call<Region[]>('/api/region', { revalidate: 3600 });
export const getCountries = () => call<Country[]>('/api/country', { revalidate: 86400 });
export const getMaps = () =>
  call<{ id: number; name: string }[]>('/api/map', { revalidate: 86400 });

// -------------------------------------------------------------------- match

const DEFAULT_MATCH_FILTERS: MatchFilters = {
  timePeriod: 0,
  includeUpcoming: false,
  includePast: false,
  includeUnpublished: false,
  includePlaceholders: false,
};

export function getMatches(args: {
  page?: number;
  pageSize?: number;
  sortBy?: string | null;
  sortOrder?: 'ASC' | 'DESC' | null;
  filters?: MatchFilters;
  revalidate?: number;
}) {
  const {
    page = 1,
    pageSize = 20,
    sortBy = 'KickOff',
    sortOrder = 'DESC',
    filters = {},
    revalidate = 60,
  } = args;
  return call<Paged<Match>>('/api/match', {
    body: {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: { ...DEFAULT_MATCH_FILTERS, ...filters },
    },
    revalidate,
  });
}

export const getMatch = (id: number) =>
  call<Match>(`/api/match/${id}`, { revalidate: 300, timeoutMs: 25000 });

export const getPlayerOfTheMatch = (id: number) =>
  call<PlayerOfTheMatch>(`/api/match/${id}/player-of-the-match`, { revalidate: 300 });

export const getLiveScores = (regionId: number) =>
  call<LiveScoreEntry[]>(`/api/match/live-scores/${regionId}`, {
    // The client polls every 12–15 seconds. A short server cache prevents all
    // visitors from fanning out to every region at the same instant.
    revalidate: 5,
    timeoutMs: 12000,
  });

export const getLiveScore = (matchId: number) =>
  call<LiveScoreEntry>(`/api/match/${matchId}/live-score`, { revalidate: 5, timeoutMs: 12000 });

/** Fetch the optional server snapshot linked by a live-score response. */
export async function getLiveServerSnapshot(
  sourceUrl: string,
  expectedEndpoint: string | null,
): Promise<LiveServerSnapshot | null> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const expectedHost = expectedEndpoint?.split(':')[0];
    if (url.hostname !== 'iosoccer.com' && (!expectedHost || url.hostname !== expectedHost)) return null;
  } catch {
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const response = await fetch(url, {
      redirect: 'manual', signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: 5 },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return parseLiveServerSnapshot(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// -------------------------------------------------------------- tournaments

export const getCurrentTournaments = () =>
  call<Tournament[]>('/api/tournaments/current', { revalidate: 300 });

export const getPastTournaments = () =>
  call<Tournament[]>('/api/tournaments/past', { revalidate: 3600, timeoutMs: 30000 });

export const getTournament = (id: number) =>
  call<Tournament>(`/api/tournaments/${id}/overview`, { revalidate: 300 });

export const getTournamentGroups = (id: number) =>
  call<TournamentGroup[]>(`/api/tournaments/${id}/groups`, { revalidate: 300 });

export const getTournamentTeams = (id: number) =>
  call<Team[]>(`/api/tournaments/${id}/teams`, { revalidate: 300 });

/** Historical statistics for a team, not evidence of current squad membership. */
export function getPlayerStatisticsForTeam(args: {
  teamId: number;
  pageSize?: number;
  filters?: StatFilters;
}) {
  const { teamId, pageSize = 200, filters = {} } = args;
  return call<Paged<PlayerStatistics>>('/api/player-statistics', {
    body: {
      page: 1,
      pageSize,
      sortBy: 'Rating',
      sortOrder: 'DESC',
      filters: { timePeriod: 0, ...filters, teamId },
    },
    revalidate: 300,
    timeoutMs: 60000,
  });
}

export const getStandings = (groupId: number) =>
  call<Standing[]>(`/api/tournament-groups/${groupId}/standings`, { revalidate: 120 });

export const getTournamentsForTeam = (teamId: number) =>
  call<Tournament[]>(`/api/tournaments/team/${teamId}`, { revalidate: 900 });

export const getTournamentsForPlayer = (playerId: number) =>
  call<Tournament[]>(`/api/tournaments/player/${playerId}`, { revalidate: 900 });

// ------------------------------------------------------------------ players

export const getPlayer = (id: number) =>
  call<Player>(`/api/player/${id}`, { revalidate: 600 });

export const searchPlayers = (name: string) =>
  call<Player[]>(`/api/player/search?playerName=${encodeURIComponent(name)}`, {
    revalidate: 300,
  });

export const getPlayerTeamHistory = (id: number) =>
  call<SquadEntry[]>(`/api/player/${id}/team-history`, { revalidate: 900 });

export function getPlayerStatistics(args: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: StatFilters;
  revalidate?: number;
  timeoutMs?: number;
}) {
  const {
    page = 1,
    pageSize = 25,
    sortBy = 'Rating',
    sortOrder = 'DESC',
    filters = {},
    revalidate = 300,
    timeoutMs = 120000,
  } = args;
  return call<Paged<PlayerStatistics>>('/api/player-statistics', {
    body: { page, pageSize, sortBy, sortOrder, filters: { timePeriod: 0, ...filters } },
    revalidate,
    // All-time aggregates are computed live upstream and measured 18-100s.
    timeoutMs,
    retry: false,
  });
}

export const getPlayerAppearanceTotals = (id: number) =>
  call<AppearanceTotal[]>(`/api/player-statistics/appearance-totals/${id}`, {
    revalidate: 900,
  });

export const getPlayerPerformance = (
  id: number,
  scale: 'continuous' | 'daily' | 'weekly' | 'monthly' = 'monthly',
) =>
  call<PerformancePoint[]>(`/api/player-statistics/performance/${scale}/${id}`, {
    revalidate: 900,
  });

// -------------------------------------------------------------------- teams

export const getTeam = (id: number) => call<Team>(`/api/team/${id}`, { revalidate: 600 });

export const getTeamsByRegion = (regionId: number) =>
  call<Team[]>(`/api/team/region/${regionId}`, { revalidate: 1800, timeoutMs: 30000 });

export const getActiveTeamSummaries = (regionId: number) =>
  call<{ id: number; name: string; teamCode: string | null }[]>(
    `/api/team/region/${regionId}/active/summaries`,
    { revalidate: 1800 },
  );

export const getTeamSquad = (id: number, orderBy = 'Name', desc = false) =>
  call<SquadEntry[]>(`/api/team/${id}/squad?orderBy=${orderBy}&orderByDesc=${desc}`, {
    revalidate: 900,
    timeoutMs: 30000,
  });

export const getTeamPlayerHistory = (id: number, orderBy = 'Name', desc = false) =>
  call<SquadEntry[]>(
    `/api/team/${id}/player-history?orderBy=${orderBy}&orderByDesc=${desc}`,
    { revalidate: 900, timeoutMs: 30000 },
  );

/** Per-day match counts for a team (activity heatmap), not aggregate stats. */
export const getTeamMatchTotals = (teamId: number) =>
  call<AppearanceTotal[]>(`/api/teamstatistics/match-totals/${teamId}`, {
    revalidate: 600,
  });

/** Aggregate career statistics for one team, via the filtered list endpoint. */
export async function getTeamAggregate(
  teamId: number,
  timePeriod = 0,
): Promise<TeamStatistics | null> {
  const page = await call<Paged<TeamStatistics>>('/api/teamstatistics', {
    body: {
      page: 1,
      pageSize: 5,
      sortBy: 'Points',
      sortOrder: 'DESC',
      filters: { timePeriod, teamId },
    },
    revalidate: 600,
    timeoutMs: 120000,
    retry: false,
  });
  return page?.items?.find((t) => t.teamId === teamId) ?? page?.items?.[0] ?? null;
}

/** Aggregate career statistics for one player, via the filtered list endpoint. */
export async function getPlayerAggregate(
  playerId: number,
  timePeriod = 0,
): Promise<PlayerStatistics | null> {
  const page = await call<Paged<PlayerStatistics>>('/api/player-statistics', {
    body: {
      page: 1,
      pageSize: 5,
      sortBy: 'Goals',
      sortOrder: 'DESC',
      filters: { timePeriod, playerId },
    },
    revalidate: 600,
    timeoutMs: 120000,
    retry: false,
  });
  return page?.items?.find((p) => p.playerId === playerId) ?? null;
}

export const getTeamPerformance = (
  teamId: number,
  scale: 'continuous' | 'daily' | 'weekly' | 'monthly' = 'monthly',
) =>
  call<PerformancePoint[]>(`/api/teamstatistics/performance/${scale}/${teamId}`, {
    revalidate: 900,
  });

export function getTeamStatistics(args: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: StatFilters;
  revalidate?: number;
}) {
  const {
    page = 1,
    pageSize = 25,
    sortBy = 'Points',
    sortOrder = 'DESC',
    filters = {},
    revalidate = 300,
  } = args;
  return call<Paged<TeamStatistics>>('/api/teamstatistics', {
    body: { page, pageSize, sortBy, sortOrder, filters: { timePeriod: 0, ...filters } },
    revalidate,
    timeoutMs: 120000,
    retry: false,
  });
}

// ---------------------------------------------------------------- ratings

export const getCurrentRatings = () =>
  call<{ id: number; name: string; rating: number; teamName: string | null }[]>(
    '/api/rating/current',
    { revalidate: 900 },
  );
