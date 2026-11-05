export interface Team {
  abbr: string;
  mlbId: number;
  name: string;
  division: string;
  aliases: string[];
}

export const TEAMS: Team[] = [
  { abbr: 'BAL', mlbId: 110, name: 'Baltimore Orioles', division: 'AL East', aliases: ['orioles', 'os'] },
  { abbr: 'BOS', mlbId: 111, name: 'Boston Red Sox', division: 'AL East', aliases: ['red sox'] },
  { abbr: 'NYY', mlbId: 147, name: 'New York Yankees', division: 'AL East', aliases: ['yankees', 'yanks'] },
  { abbr: 'TB', mlbId: 139, name: 'Tampa Bay Rays', division: 'AL East', aliases: ['rays'] },
  { abbr: 'TOR', mlbId: 141, name: 'Toronto Blue Jays', division: 'AL East', aliases: ['blue jays', 'jays'] },
  { abbr: 'CWS', mlbId: 145, name: 'Chicago White Sox', division: 'AL Central', aliases: ['white sox'] },
  { abbr: 'CLE', mlbId: 114, name: 'Cleveland Guardians', division: 'AL Central', aliases: ['guardians'] },
  { abbr: 'DET', mlbId: 116, name: 'Detroit Tigers', division: 'AL Central', aliases: ['tigers'] },
  { abbr: 'KC', mlbId: 118, name: 'Kansas City Royals', division: 'AL Central', aliases: ['royals'] },
  { abbr: 'MIN', mlbId: 142, name: 'Minnesota Twins', division: 'AL Central', aliases: ['twins'] },
  { abbr: 'ATH', mlbId: 133, name: 'Athletics', division: 'AL West', aliases: ['athletics'] },
  { abbr: 'HOU', mlbId: 117, name: 'Houston Astros', division: 'AL West', aliases: ['astros'] },
  { abbr: 'LAA', mlbId: 108, name: 'Los Angeles Angels', division: 'AL West', aliases: ['angels'] },
  { abbr: 'SEA', mlbId: 136, name: 'Seattle Mariners', division: 'AL West', aliases: ['mariners'] },
  { abbr: 'TEX', mlbId: 140, name: 'Texas Rangers', division: 'AL West', aliases: ['rangers'] },
  { abbr: 'ATL', mlbId: 144, name: 'Atlanta Braves', division: 'NL East', aliases: ['braves'] },
  { abbr: 'MIA', mlbId: 146, name: 'Miami Marlins', division: 'NL East', aliases: ['marlins'] },
  { abbr: 'NYM', mlbId: 121, name: 'New York Mets', division: 'NL East', aliases: ['mets'] },
  { abbr: 'PHI', mlbId: 143, name: 'Philadelphia Phillies', division: 'NL East', aliases: ['phillies', 'phils'] },
  { abbr: 'WSH', mlbId: 120, name: 'Washington Nationals', division: 'NL East', aliases: ['nationals', 'nats'] },
  { abbr: 'CHC', mlbId: 112, name: 'Chicago Cubs', division: 'NL Central', aliases: ['cubs'] },
  { abbr: 'CIN', mlbId: 113, name: 'Cincinnati Reds', division: 'NL Central', aliases: ['reds'] },
  { abbr: 'MIL', mlbId: 158, name: 'Milwaukee Brewers', division: 'NL Central', aliases: ['brewers'] },
  { abbr: 'PIT', mlbId: 134, name: 'Pittsburgh Pirates', division: 'NL Central', aliases: ['pirates', 'bucs'] },
  { abbr: 'STL', mlbId: 138, name: 'St. Louis Cardinals', division: 'NL Central', aliases: ['cardinals'] },
  { abbr: 'ARI', mlbId: 109, name: 'Arizona Diamondbacks', division: 'NL West', aliases: ['diamondbacks', 'dbacks', 'd backs'] },
  { abbr: 'COL', mlbId: 115, name: 'Colorado Rockies', division: 'NL West', aliases: ['rockies'] },
  { abbr: 'LAD', mlbId: 119, name: 'Los Angeles Dodgers', division: 'NL West', aliases: ['dodgers'] },
  { abbr: 'SD', mlbId: 135, name: 'San Diego Padres', division: 'NL West', aliases: ['padres'] },
  { abbr: 'SF', mlbId: 137, name: 'San Francisco Giants', division: 'NL West', aliases: ['giants'] },
];

export const TEAM_BY_ABBR = new Map(TEAMS.map((t) => [t.abbr, t]));
export const TEAM_BY_MLB_ID = new Map(TEAMS.map((t) => [t.mlbId, t]));
export const DIVISIONS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];
