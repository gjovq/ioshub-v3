// Types derived from live probing of https://iosoccer.com:44380
// Every relationship can be null — the API expands lazily.

export interface AssetImage {
  id: number;
  fileName: string | null;
  allowDirectAccess: boolean;
  originalUrl: string | null;
  largeUrl: string | null;
  mediumUrl: string | null;
  smallUrl: string | null;
  extraSmallUrl: string | null;
}

export interface Region {
  regionId: number;
  regionName: string;
  regionCode: string;
  serverCount: number;
  matchCount: number;
  teamCount: number;
  matchFormat: number;
}

export interface Country {
  id: number;
  code: string;
  name: string;
  discordFlagEmote: string | null;
}

export interface SystemColor {
  rawValue: number;
  r: number;
  g: number;
  b: number;
}

export interface Team {
  id: number;
  name: string;
  teamCode: string | null;
  kitEmote: string | null;
  badgeEmote: string | null;
  badgeImageId: number | null;
  badgeImage: AssetImage | null;
  fantasyKitImageId: number | null;
  fantasyKitImage: AssetImage | null;
  displayName: string | null;
  teamType: number;
  regionId: number;
  region: Region | null;
  guildId: number | null;
  color: string | null;
  systemColor: SystemColor | null;
  foundedDate: string | null;
  /** last 5 results, most recent last. 0 = loss, 1 = draw, 2 = win */
  form: number[] | null;
  inactive: boolean;
  unlisted: boolean;
  rating: number | null;
  createdDate: string;
  updatedDate: string;
}

export interface Player {
  id: number;
  name: string;
  displayName: string | null;
  steamID: string | null;
  discordUserId: string | null;
  discordUserMention: string | null;
  rating: number | null;
  countryId: number | null;
  country: Country | null;
  hubRole: number;
  donatorLevel: number;
  playingSince: string | null;
  createdDate: string;
  updatedDate: string;
}

export interface Organisation {
  id: number;
  name: string;
  acronym: string | null;
  logoImageId: number | null;
  logoImage: AssetImage | null;
  brandColour: string | null;
}

export interface TournamentSeries {
  id: number;
  name: string;
  isPublic: boolean;
  isActive: boolean;
  tournamentLogoId: number | null;
  tournamentLogo: AssetImage | null;
  organisationId: number | null;
  organisation: Organisation | null;
}

export interface Tournament {
  id: number;
  name: string;
  isPublic: boolean;
  tournamentSeriesId: number | null;
  tournamentSeries: TournamentSeries | null;
  startDate: string | null;
  hasStarted: boolean;
  endDate: string | null;
  hasEnded: boolean;
  tournamentType: number;
  teamType: number;
  format: number;
  fantasyPointsLimit: number;
  winningTeamId: number | null;
  winningTeam: Team | null;
  tournamentStages: TournamentStage[] | null;
}

export interface TournamentStage {
  id: number;
  name: string | null;
  tournamentGroups?: TournamentGroup[] | null;
}

export interface TournamentGroupTeam {
  id: number;
  teamId: number;
  team: Team | null;
  standingOverrideWeighting?: number;
}

export interface TournamentGroup {
  id: number;
  name: string;
  tournamentStageId: number | null;
  tournamentStage: TournamentStage | null;
  tournamentGroupTeams: TournamentGroupTeam[] | null;
  tournamentGroupMatches: TournamentGroupMatch[] | null;
}

export interface TournamentGroupMatch {
  id: number;
  matchId: number | null;
  match: Match | null;
  tournamentGroupId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  scheduledDate?: string | null;
}

export interface Standing {
  position: number;
  teamName: string;
  teamId: number;
  teamCode: string | null;
  badgeImageUrl: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  points: number;
  standingOverrideWeighting: number;
  form: number[] | null;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface MatchEvent {
  event: string;
  period: string;
  player1SteamId: string;
  /** live-scores events carry inline names; match-file events do not */
  player1Name?: string | null;
  player2SteamId: string;
  player2Name?: string | null;
  player3SteamId?: string;
  player3Name?: string | null;
  second: number;
  team: 'home' | 'away';
  bodyPart: number;
  startPosition: Vec2 | null;
  endPosition?: Vec2 | null;
}

export interface MatchDataTeam {
  matchTotal: {
    name: string;
    side: 'home' | 'away';
    isMix: boolean;
    statistics: number[];
  };
  matchPeriods: {
    period: number;
    periodName: string;
    announcedInjuryTimeSeconds: number;
    actualInjuryTimeSeconds: number;
    statistics: number[];
  }[];
}

export interface MatchDataPlayer {
  info: { steamId: string; steamId64: string; name: string };
  matchPeriodData: {
    info: {
      startSecond: number;
      endSecond: number;
      team: 'home' | 'away';
      position: string;
      isHomeTeam: boolean;
      isAwayTeam: boolean;
    };
    statistics: number[];
  }[];
}

export interface MatchData {
  matchInfo: {
    type: string;
    startTime: number;
    endTime: number;
    periods: number;
    lastPeriodName: string;
    mapName: string;
    format: number;
    serverName: string;
    fieldMin: Vec2;
    fieldMax: Vec2;
  };
  teams: MatchDataTeam[];
  players: MatchDataPlayer[];
  matchEvents: MatchEvent[];
}

export interface MatchStatistics {
  id: number;
  matchData: MatchData | null;
  token: string | null;
  sourceAddress: string | null;
  kickOff: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  matchGoalsHome: number | null;
  matchGoalsAway: number | null;
  knockoutMatchWinner: number;
  createdDate: string;
}

export interface Match {
  id: number;
  teamHomeId: number | null;
  teamHome: Team | null;
  teamAwayId: number | null;
  teamAway: Team | null;
  serverId: number | null;
  server: {
    id: number;
    name: string | null;
    hasRconPassword?: boolean;
    isActive?: boolean;
  } | null;
  matchStatisticsId: number | null;
  matchStatistics: MatchStatistics | null;
  kickOff: string;
  format: number;
  matchType: number;
  mapId: number | null;
  map: { id: number; name: string } | null;
  playerOfTheMatchId: number | null;
  playerOfTheMatch: Player | null;
  tournamentId: number | null;
  tournament: Tournament | null;
}

export interface LiveScoreState {
  matchPeriod: string;
  startTime: number;
  matchSeconds: number;
  matchDisplaySeconds: string;
  mapName: string;
  serverPlayerCount: number;
  serverMaxPlayers: number;
  matchFormat: number;
  matchGoalsHome: number;
  matchGoalsAway: number;
  teamNameHome: string;
  teamNameAway: string;
  teamCodeHome: string | null;
  teamCodeAway: string | null;
  matchDataToken: string | null;
  matchDataUrl: string | null;
  teamLineupHome: { position: string; name: string | null; steamId: string | null }[];
  teamLineupAway: { position: string; name: string | null; steamId: string | null }[];
  matchEvents: MatchEvent[] | null;
  allPlayers: unknown[] | null;
}

/** live-scores returns C# tuples serialised as item1/item2 */
export interface LiveScoreEntry {
  item1: Match;
  item2: LiveScoreState;
}

export interface StatBlock {
  redCards: number;
  redCardsAverage: number;
  yellowCards: number;
  yellowCardsAverage: number;
  fouls: number;
  foulsAverage: number;
  foulsSuffered: number;
  foulsSufferedAverage: number;
  slidingTacklesAverage: number;
  slidingTacklesCompletedAverage: number;
  goalsConceded: number;
  goalsConcededAverage: number;
  goals: number;
  goalsAverage: number;
  ownGoals: number;
  assists: number;
  assistsAverage: number;
  ownGoalsAverage: number;
  shots: number;
  shotsAverage: number;
  shotsOnGoal: number;
  shotsOnGoalAverage: number;
  shotAccuracyPercentage: number;
  passes: number;
  passesAverage: number;
  passesCompleted: number;
  passesCompletedAverage: number;
  passCompletionPercentageAverage: number;
  interceptions: number;
  interceptionsAverage: number;
  offsides: number;
  offsidesAverage: number;
  freeKicks: number;
  penalties: number;
  corners: number;
  throwIns: number;
  keeperSaves: number;
  keeperSavesAverage: number;
  keeperSavesCaughtAverage: number;
  goalKicksAverage: number;
  possessionAverage: number;
  possessionPercentageAverage: number;
  distanceCoveredAverage: number;
  chancesCreated: number;
  chancesCreatedAverage: number;
  keyPasses: number;
  keyPassesAverage: number;
  secondAssists: number;
  secondAssistsAverage: number;
  expectedGoals: number;
  expectedGoalsAverage: number;
  shotConversionPercentage: number;
  keeperSavePercentage: number | null;
  goalDifference: number;
  points: number;
  appearances: number;
  substituteAppearances: number;
  wins: number;
  winPercentage: number;
  draws: number;
  drawPercentage: number;
  losses: number;
  lossPercentage: number;
  form: number[] | null;
}

export interface PlayerStatistics extends StatBlock {
  playerId: number;
  name: string;
  steamID: string | null;
  rating: number;
  countryId: number | null;
  secondsPlayed: number;
}

export interface TeamStatistics extends StatBlock {
  teamId: number;
  teamName: string;
  badgeImageUrl: string | null;
  lastMatchDate: string | null;
  channelId: number | null;
}

export interface SquadEntry extends StatBlock {
  playerTeam: {
    playerId: number;
    player: Player;
    teamId: number;
    team: Team | null;
    teamRole: number;
    isCurrentTeam: boolean;
    isPending: boolean;
    joinDate: string | null;
    leaveDate: string | null;
  };
  position: { id: number; name: string } | null;
}

export interface Paged<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortOrder: string | null;
  offset: number;
}

export interface PerformancePoint {
  playerId?: number;
  teamId?: number;
  day: number | null;
  week: number | null;
  month: number | null;
  year: number;
  averageGoals: number;
  averageAssists: number;
  averageGoalsConceded: number;
  cleanSheets: number;
  appearances: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface AppearanceTotal {
  matches: number;
  matchDayDate: string;
}

export interface PlayerOfTheMatch {
  playerId: number;
  playerName: string;
  positionGroup: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  interceptions: number;
  passCompletion: number;
  keeperSaves: number;
}

/** Mirrors the compiled Angular filter class */
export interface MatchFilters {
  timePeriod?: number;
  includeUpcoming?: boolean;
  includePast?: boolean;
  includeUnpublished?: boolean;
  includePlaceholders?: boolean;
  regionId?: number | null;
  matchFormat?: number | null;
  matchType?: number | null;
  matchTeamType?: number | null;
  teamId?: number | null;
  oppositionTeamId?: number | null;
  tournamentId?: number | null;
  tournamentStageId?: number | null;
  playerId?: number | null;
  headToHead?: boolean;
}

export interface StatFilters {
  timePeriod?: number;
  regionId?: number | null;
  teamId?: number | null;
  tournamentId?: number | null;
  playerName?: string | null;
  teamName?: string | null;
  positionName?: string | null;
  positionGroup?: number | null;
  matchFormat?: number | null;
  matchType?: number | null;
  matchTeamType?: number | null;
  teamType?: number | null;
  minimumAppearances?: number | null;
  minimumMatches?: number | null;
  minimumRating?: number | null;
  maximumRating?: number | null;
  minimumSecondsPlayed?: number | null;
  includeInactive?: boolean;
  includeSubstituteAppearances?: boolean;
  freeAgentsOnly?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
}
