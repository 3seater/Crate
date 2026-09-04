export interface SportsResult {
  awayTeam: string;
  elapsed?: string;
  ended: boolean;
  finished_timestamp?: string;
  gameId: number;
  homeTeam: string;
  leagueAbbreviation: string;
  live: boolean;
  period: string;
  score: string;
  slug: string;
  status: string;
  turn?: string;
}

/** Sports metadata for markets/events - teams, market types, game start time */
export interface SportsMetadata {
  game_start_time?: string;
  market_types?: string[];
  teams?: Array<{ name: string; image: string }>;
}
