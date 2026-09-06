// Enum values extracted verbatim from the compiled IOSoccer Angular bundle.

/** Index into the raw `statistics: number[]` arrays inside matchData */
export const StatIndex = {
  RedCards: 0,
  YellowCards: 1,
  Fouls: 2,
  FoulsSuffered: 3,
  SlidingTackles: 4,
  SlidingTacklesCompleted: 5,
  GoalsConceded: 6,
  Shots: 7,
  ShotsOnGoal: 8,
  PassesCompleted: 9,
  Interceptions: 10,
  Offsides: 11,
  Goals: 12,
  OwnGoals: 13,
  Assists: 14,
  Passes: 15,
  FreeKicks: 16,
  Penalties: 17,
  Corners: 18,
  ThrowIns: 19,
  KeeperSaves: 20,
  GoalKicks: 21,
  Possession: 22,
  DistanceCovered: 23,
  KeeperSavesCaught: 24,
  KeyPasses: 25,
  ChancesCreated: 26,
  SecondAssists: 27,
  ExpectedGoals: 28,
} as const;

export const TimePeriod = {
  Week: 7,
  Month: 31,
  Year: 365,
  AllTime: 0,
} as const;

export const TIME_PERIODS = [
  { value: 0, label: 'All time' },
  { value: 365, label: 'Last year' },
  { value: 31, label: 'Last month' },
  { value: 7, label: 'Last week' },
];

export const MatchType = {
  UnrankedFriendly: 0,
  RankedFriendly: 1,
  Competition: 2,
} as const;

export const MATCH_TYPE_LABEL: Record<number, string> = {
  0: 'Friendly',
  1: 'Ranked',
  2: 'Competition',
};

export const TeamType = {
  Club: 1,
  National: 2,
  Mix: 3,
  Draft: 4,
} as const;

export const TEAM_TYPE_LABEL: Record<number, string> = {
  1: 'Club',
  2: 'National',
  3: 'Mix',
  4: 'Draft',
};

export const TEAM_ROLE_LABEL: Record<number, string> = {
  0: 'Trialist',
  1: 'Reserve',
  2: 'Loanee',
  3: 'Loaned out',
  4: 'Player',
  5: 'Vice-captain',
  6: 'Captain',
};

export const TOURNAMENT_TYPE_LABEL: Record<number, string> = {
  0: 'Knockout',
  1: 'Round robin',
  2: 'Double round robin',
  3: 'Knockout (seeded)',
  4: 'Round robin ladder',
  5: 'Double round robin ladder',
  6: 'Round robin + knockout',
};

export const POSITION_GROUP_LABEL: Record<number, string> = {
  0: 'Goalkeeper',
  1: 'Defence',
  2: 'Midfield',
  3: 'Attack',
};

export const BODY_PART_LABEL: Record<number, string> = {
  0: '',
  1: 'Foot',
  2: 'Hip',
  3: 'Chest',
  4: 'Head',
  5: 'Hands',
  6: 'Keeper catch',
  7: 'Keeper punch',
  8: 'Keeper hands',
  9: 'Unknown',
};

export const HUB_ROLE_LABEL: Record<number, string> = {
  0: 'Player',
  5: 'Tournament manager',
  10: 'Manager',
  20: 'Administrator',
  30: 'Owner',
};

export const DONATOR_LABEL: Record<number, string> = {
  0: '',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
};

/**
 * Result codes used in `form` arrays, from the client's MatchOutcome enum.
 * Verified against live standings: a 4W-0D-0L team returns [0,0,0,0].
 */
export const MatchOutcome = { Win: 0, Draw: 1, Loss: 2, Unknown: 3 } as const;

export function outcomeLetter(v: number): 'W' | 'D' | 'L' | '·' {
  return v === 0 ? 'W' : v === 1 ? 'D' : v === 2 ? 'L' : '·';
}

/** Position codes seen in lineups, ordered back to front */
export const PITCH_POSITIONS = [
  'GK',
  'LB',
  'CB',
  'RB',
  'LM',
  'CM',
  'RM',
  'LW',
  'CF',
  'RW',
] as const;

export function positionGroupOf(position: string): number {
  const p = position.toUpperCase();
  if (p === 'GK') return 0;
  if (p.endsWith('B') || p === 'SW') return 1;
  if (p.endsWith('M') || p === 'DM' || p === 'AM') return 2;
  return 3;
}
