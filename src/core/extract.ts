import type { Status, ThreadType } from './schemas';
import { TEAM_BY_ABBR, TEAMS } from './teams';
import { nameKey, normalizeText } from './text';

export interface PlayerEntry {
  mlbamId: number;
  name: string;
}

export interface AliasEntry extends PlayerEntry {
  match: string;
  /** Team context required when a name is shared by several players. */
  team?: string;
}

export interface PlayerIndex {
  byName: Map<string, PlayerEntry[]>;
  aliases: AliasEntry[];
}

export function buildPlayerIndex(players: PlayerEntry[], aliases: AliasEntry[] = []): PlayerIndex {
  const byName = new Map<string, PlayerEntry[]>();
  for (const player of players) {
    const key = nameKey(player.name);
    const existing = byName.get(key) ?? [];
    if (!existing.some((entry) => entry.mlbamId === player.mlbamId)) existing.push(player);
    byName.set(key, existing);
  }
  return { byName, aliases: aliases.map((alias) => ({ ...alias, match: nameKey(alias.match) })) };
}

/** Clubs in other leagues whose nicknames collide with MLB nicknames. */
const FOREIGN_CLUBS =
  /\b(kbo|npb|cpbl)\b|\b(lg twins|kia tigers|lotte giants|samsung lions|doosan bears|hanwha eagles|ssg landers|kt wiz|nc dinos|kiwoom heroes|hanshin tigers|yomiuri giants|softbank hawks|chunichi dragons|hiroshima carp|yakult swallows|nippon ham fighters|seibu lions|orix buffaloes|rakuten eagles|lotte marines|yokohama baystars)\b/g;

const NHL_NFL_CONTEXT = /\b(nfl|nhl|nba|quarterback|touchdown|goalie|super bowl)\b/;

export function findTeams(normalized: string): string[] {
  if (NHL_NFL_CONTEXT.test(normalized)) return [];
  const text = normalized.replace(FOREIGN_CLUBS, ' ').replace(/\bred sox\b/g, 'redsox').replace(/\bwhite sox\b/g, 'whitesox');
  const hits: Array<[number, string]> = [];
  for (const team of TEAMS) {
    for (const alias of team.aliases) {
      const needle = alias.replace(/\bred sox\b/, 'redsox').replace(/\bwhite sox\b/, 'whitesox');
      const at = text.search(new RegExp(`\\b${needle}\\b`));
      if (at >= 0) {
        hits.push([at, team.abbr]);
        break;
      }
    }
  }
  return hits.sort((a, b) => a[0] - b[0]).map(([, abbr]) => abbr);
}

export function findPlayers(normalized: string, teams: string[], index: PlayerIndex): { players: PlayerEntry[]; ambiguous: string[] } {
  const tokens = normalized.split(' ');
  const found = new Map<number, PlayerEntry>();
  const ambiguous = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    for (let size = 4; size >= 2; size -= 1) {
      if (i + size > tokens.length) continue;
      const candidate = tokens.slice(i, i + size).join(' ');
      const aliases = index.aliases.filter((alias) => alias.match === candidate);
      const contextual = aliases.filter((alias) => alias.team && teams.includes(alias.team));
      const open = aliases.filter((alias) => !alias.team);
      const entries = index.byName.get(candidate) ?? [];
      if (contextual.length === 1) {
        found.set(contextual[0].mlbamId, contextual[0]);
      } else if (open.length === 1) {
        found.set(open[0].mlbamId, open[0]);
      } else if (entries.length === 1 && aliases.length === 0) {
        found.set(entries[0].mlbamId, entries[0]);
      } else if (entries.length > 1 || aliases.length > 0) {
        ambiguous.add(candidate);
      } else {
        continue;
      }
      i += size - 1;
      break;
    }
  }
  return { players: [...found.values()], ambiguous: [...ambiguous] };
}

const MEDIA = /\b(after dark|discussion thread|open thread|game thread|podcast|youtube|spotify|apple podcasts?|webcast|bit ly|trib al|mailbag|chat transcript|poll|live chat|episode|newsletter|on this day|this day in|hall of fame)\b/;
const ROUNDUP = /\b(notes|links|roundup|round up|intel|buzz|the opener|what we re hearing|what were hearing|takeaways|live updates|tracker|recap|news:|rumors|news and rumors|storylines|grades)\b/;
const SPECULATIVE =
  /\b(could|would|should|might|may|if|why|how|what|where|when|who|which|whether|predict\w*|project\w*|landing spots?|rankings?|ranked|best|biggest|top \d+|mock|proposal|grade\w*|fits?|wish ?list|ideal|wants?|hopes?|expected|likely|unlikely|possible|potential|consider\w*|consolation|imagining|dream|hints?|suggest\w*|before|after|since|never|not|wont|didnt|doesnt|dont|without|unable|fails?|failed|submitted|among|try|tries|trying|posts?|posted|posting|qualifying offer|rumou?r\w*|target|targets)\b/;
const FELL =
  /\b(talks?\b.{0,60}\b(ended|broke down|broken down|collapsed|stalled)|talks? end|deal (fell|falls|falling|fall) (through|apart)|deal (is )?off|no longer (pursuing|interested|in talks|in the running|in on|considering|engaged)|out of the running|backed out of (a |the |trade|deal)|pulled out of (a |the |trade|deal|talks)|withdr[ae]w (an |the |his |their )?offer|withdr[ae]w from (talks|negotiations|the (race|bidding|sweepstakes))|rescinded|voided|negotiations (ended|collapsed|broke down|have ended)|will not pursue|wont pursue|walk away from|walked away from)\b/;
const TALKS =
  /\b(in talks|talks with|negotiat\w+|nearing|close to (a |an )?(deal|signing|agreement|acquiring|trade)|closing in on|discussing|discussions with|finalizing|deal in place pending)\b/;
const AGREEMENT =
  /\b(signs? (with|back|a|to)|signs? [a-z]+ [a-z]+|signed|re sign(s|ed)?|agrees? to (a |an |new |minor |major |\d|one|two|three|four|five|six|seven|eight|nine|ten)|agreed to (a |an |new |minor |major |\d|one|two|three|four|five|six|seven|eight|nine|ten)|agree to deal|in agreement|have a deal with|has a deal with|acquires?|acquired|re acquired|trades? for|traded (to|for)|being traded to|trades? [a-z]+ [a-z]+ to|(deals?) [a-z]+ [a-z]+ to|to [a-z]+ minors deal|claims? ([a-z]+ )?[a-z]+ [a-z]+|claimed|inks?|inked|deal with|year deal|[a-z]+ extension)\b/;
// Game talk and non-move uses of the same verbs: "lands on the IL", "the HOF sign", "he signed autographs".
const NOT_A_MOVE =
  /\b(momentum|toward|hoping|hopes|good signs|skies|rbi|singles?|doubles?(?! a\b)|triples?(?! a\b)|homers?|home run|innings?|hitting streak|extends? (his|the|their)|scratched|on the mound|lands? on|player that|that the [a-z]+ signed|the [a-z]+ signed|hof sign|sign the|stop sign|claim (he|she|they|that|to)|autographs?|bobblehead|wanting to be|column|wrote about|icymi|recap|decline|active for|added to the active)\b/;
const INTEREST =
  /\b(interested in|interest in|have interest|has interest|showing interest|pursu\w+|eyes?|eyeing|targeting|checked in|check in|meet with|met with|meeting with|on (the )?radar|scouting|monitoring|kicked tires|linked to|in the mix|suitors?|courting|in on)\b/;
const MOVE = /\b(release[sd]?|designat\w+|dfa|outright\w*|waivers?|option(ed|s)?|opts? out|non ?tender\w*|qualifying offer|retire[sd]?)\b/;
const PLAYER_MARKET = /\b(free agen\w+|trades?|traded|contract|extension|qualifying offer|deal|suitors?|market|offseason|hot stove|rumou?rs?|target|targets|pursuit|sign(s|ed|ing)?)\b/;
const GAME_STORY =
  /\b(game \d|world series|playoffs?|postseason|alcs|nlcs|alds|nlds|wild card|clinch\w*|homers?|home run|strikes? out|walk off|box score|lineup|injury|injured|surgery|mvp|cy young|gold glove|silver slugger)\b/;
const STAFF_ROLE =
  /\b(hire[sd]?|hiring|manager|managerial|bench coach|pitching coach|hitting coach|first base coach|third base coach|bullpen coach|coach|coaches|coaching staff|general manager|gm|president of baseball operations|front office|baseball operations|assistant gm)\b/;
const STAFF_ACTION =
  /\b(hire[sd]?|hiring|names?|named|interview\w*|candidates?|leaves?|left|fire[sd]?|firing|dismiss\w*|promot\w*|announce\w*|add|adds|added|search|retain\w*|depart\w*|part ways|extend\w*|extension|finalists?)\b/;
const LABOR = /\b(lockout|salary cap|cba|collective bargaining|labor|mlbpa|players union|work stoppage|salary floor)\b/;
const TEAM_NEED =
  /\b(open to|pursue|pursuing|targets?|seek\w*|market for|looking for|additions?|needs?|shop|interested in|interest in|plans?|upgrades?|offseason|hot stove|rumou?rs?|notes|addition)\b/;
const MARKET = /\b(free agen\w+|trade (market|deadline|targets?|rumou?rs?|chips?)|qualifying offers?|rumou?rs?)\b/;

// Predictions and wish lists aren't reports, so they stay Unclassified rather than Linked.
const CONDITIONAL = /\b(could|would|might|may|if|target|targets|rumou?r\w*|expected|likely|potential|possible|consider\w*)\b/;
const PREDICTION = /\b(predict\w*|project\w*|landing spots?|wish ?list|ideal|mock|best fits?|why|how|what|where|when|who|which|whether|should)\b/;

const TEAM_TOPICS: Array<[RegExp, string, string]> = [
  [/\b(rotation|starters?|starting pitch\w*|aces?)\b/, 'rotation', 'rotation'],
  [/\b(bullpen|relievers?|relief|closers?|setup)\b/, 'bullpen', 'bullpen'],
  [/\b(catchers?|catching)\b/, 'catcher', 'catcher'],
  [/\b(infield\w*|shortstops?|second base\w*|third base\w*|first base\w*)\b/, 'infield', 'infield'],
  [/\b(outfield\w*|center field\w*|left field\w*|right field\w*)\b/, 'outfield', 'outfield'],
  [/\b(designated hitter|sluggers?|power bat|lineup|offense)\b/, 'lineup', 'lineup'],
  [/\b(payroll|budget|ownership|owners?|sale|spending)\b/, 'money', 'payroll and ownership'],
];

/** Splits a club's general news by topic, so unrelated items don't share a thread. */
export function teamTopic(normalized: string): { key: string; label: string } | null {
  for (const [pattern, key, label] of TEAM_TOPICS) if (pattern.test(normalized)) return { key, label };
  return null;
}

const MARKET_TOPICS: Array<[RegExp, string, string]> = [
  [/\bqualifying offers?\b/, 'qualifying-offers', 'Qualifying offers'],
  [/\b(rankings?|ranked|top \d+|best free agents?)\b/, 'rankings', 'Free agent rankings'],
  [/\btrades?\b/, 'trades', 'The trade market'],
  [/\bfree agen\w+\b/, 'free-agency', 'Free agency'],
];

const OPENING_NOT_A_MOVE = /\b(says?|said|talks|(have|has|been|was) (optioned|recalled)|recalled from|called up|calling up|has arrived|was acquired|acquired (in|from [a-z ]+ last)|added to|story|column|official(ly)? (now )?for|sign in)\b/;

/**
 * A done deal is the strictest claim here. The player and the move must share the opening
 * sentence, because later sentences often describe someone else or an older move.
 */
export function confirmsDeal(rawTitle: string, player: PlayerEntry): boolean {
  const opening = normalizeText(openingSentence(rawTitle));
  return AGREEMENT.test(opening) && !NOT_A_MOVE.test(opening) && !OPENING_NOT_A_MOVE.test(opening) && opening.includes(nameKey(player.name));
}

function openingSentence(rawTitle: string): string {
  return rawTitle.split(/(?<=[.!?])\s+/).reduce((text, part) => (text.length >= 30 ? text : `${text} ${part}`), '').trim();
}

/** Clubs a report is mainly about: those in its opening sentence, at most two. */
export function focusTeams(rawTitle: string): string[] {
  return findTeams(normalizeText(openingSentence(rawTitle).slice(0, 180))).slice(0, 2);
}

const COMMON_WORD_NAMES = new Set(['story', 'judge', 'price', 'rice', 'bell', 'best', 'early', 'young', 'hicks', 'white', 'black', 'brown', 'green', 'gray', 'king', 'walker', 'turner', 'miller', 'trade', 'deal', 'base', 'first', 'second', 'third', 'notes', 'news', 'free', 'agent', 'marte', 'garcia', 'rodriguez', 'martinez', 'smith', 'jones', 'johnson', 'williams', 'perez', 'ramirez']);

/**
 * Finds players named only by last name, using players already reported with that club.
 * A last name must point to one player on that club, and it only ever creates a mention.
 */
export function findSurnameMentions(rawTitle: string, teams: string[], known: Map<string, Map<string, PlayerEntry[]>>): PlayerEntry[] {
  const words = rawTitle.match(/\b\p{Lu}[\p{L}'\u2019-]{3,}\b/gu) ?? [];
  const found = new Map<number, PlayerEntry>();
  for (const word of words) {
    const key = normalizeText(word);
    if (COMMON_WORD_NAMES.has(key)) continue;
    for (const team of teams) {
      const matches = known.get(team)?.get(key);
      if (matches?.length === 1) found.set(matches[0].mlbamId, matches[0]);
    }
  }
  return [...found.values()];
}

export function surnameOf(name: string): string {
  return nameKey(name).split(' ').pop() ?? '';
}

export function classifyStatus(rawTitle: string, normalized: string): Status | null {
  if (MEDIA.test(normalized) || ROUNDUP.test(normalized)) return null;
  if (FELL.test(normalized) && !NOT_A_MOVE.test(normalized)) return 'Fell through';
  const speculative = rawTitle.includes('?') || SPECULATIVE.test(normalized);
  if (speculative) {
    if (TALKS.test(normalized) && !/\b(could|would|might|may|if|why|how|what|when|whether)\b/.test(normalized) && !rawTitle.includes('?')) return 'Talks';
    if (INTEREST.test(normalized)) return 'Interest';
    // Words like "not" or "after" only make a report unclear. They don't link a player to a club.
    if (PREDICTION.test(normalized) && !rawTitle.includes('?')) return 'Unclassified';
    if ((rawTitle.includes('?') || CONDITIONAL.test(normalized)) && !/\bqualifying offer\b/.test(normalized)) return 'Linked';
    return 'Unclassified';
  }
  if (NOT_A_MOVE.test(normalized)) return 'Unclassified';
  if (TALKS.test(normalized)) return 'Talks';
  // Interest comes first: "Interested In Long-Term Deal With X" isn't a deal.
  if (INTEREST.test(normalized)) return 'Interest';
  if (AGREEMENT.test(normalized)) return 'Agreement reported';
  return 'Unclassified';
}

export interface Extraction {
  relevant: boolean;
  type: ThreadType | null;
  subjectKey: string | null;
  subject: string | null;
  teams: string[];
  players: PlayerEntry[];
  ambiguous: string[];
  roundup: boolean;
  status: Status | null;
  deal: { years: number | null; amountUsd: number | null; minor: boolean } | null;
}

const WORD_YEARS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function extractDeal(normalized: string): { years: number | null; amountUsd: number | null; minor: boolean } {
  const years = normalized.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten) year\b/);
  const money = normalized.match(/\$\s?(\d+(?:\.\d+)?)\s?(billion|million|mm|m|b)?\b/);
  let amountUsd: number | null = null;
  if (money) {
    const scale = money[2] && /^b/.test(money[2]) ? 1e9 : 1e6;
    amountUsd = Number(money[1]) * scale;
  }
  return {
    years: years ? WORD_YEARS[years[1]] ?? Number(years[1]) : null,
    amountUsd,
    minor: /\bminor league\b/.test(normalized),
  };
}

/** Classifies one item from its title alone. Feed text only ever adds mentions, in the pipeline. */
export function extract(rawTitle: string, index: PlayerIndex, contextTeam?: string): Extraction {
  const normalized = normalizeText(rawTitle);
  const named = findTeams(normalized);
  // A team site's headlines often skip the club's name.
  const teams = contextTeam && !named.includes(contextTeam) ? [...named, contextTeam] : named;
  const { players, ambiguous } = findPlayers(normalized, teams, index);
  // Keep clubs named in passing from tagging the story. Team sites always keep their club.
  const focused = focusTeams(rawTitle);
  const tagged = focused.length > 0 ? focused : teams;
  const storyTeams = contextTeam && !tagged.includes(contextTeam) ? [...tagged, contextTeam] : tagged;
  const base = { teams: storyTeams, players, ambiguous, deal: null };
  const none: Extraction = { ...base, relevant: false, type: null, subjectKey: null, subject: null, roundup: false, status: null };

  if (MEDIA.test(normalized)) return none;
  const roundup = ROUNDUP.test(normalized) || /\bnews:.*,/i.test(rawTitle) || players.length >= 3 || (rawTitle.split(':')[1]?.split(',').length ?? 0) >= 3;

  if (LABOR.test(normalized)) {
    return { ...base, teams: [], relevant: true, type: 'league', subjectKey: 'league-labor', subject: 'Labor and the CBA', roundup, status: null };
  }
  if (STAFF_ROLE.test(normalized) && STAFF_ACTION.test(normalized) && teams.length >= 1) {
    const team = storyTeams[0] ?? teams[0];
    return { ...base, teams: [team], relevant: true, type: 'staff', subjectKey: `staff-${team.toLowerCase()}`, subject: `${TEAM_BY_ABBR.get(team)?.name ?? team} staff and front office`, roundup, status: null };
  }
  if (players.length >= 1 && !roundup) {
    let status = classifyStatus(rawTitle, normalized);
    const strong = status === 'Talks' || status === 'Interest' || status === 'Agreement reported' || status === 'Fell through';
    const market = MOVE.test(normalized) || PLAYER_MARKET.test(normalized);
    if (GAME_STORY.test(normalized) && !market) return none;
    if (!strong && !market) return none;
    // "Linked" claims a connection to a club, so it needs a club and a market signal.
    if (status === 'Agreement reported' && !confirmsDeal(rawTitle, players[0])) status = 'Unclassified';
    if (status === 'Linked' && (teams.length === 0 || !PLAYER_MARKET.test(normalized))) status = 'Unclassified';
    const player = players[0];
    const deal = status === 'Agreement reported' ? extractDeal(normalized) : null;
    return { ...base, relevant: true, type: 'player', subjectKey: `player-${player.mlbamId}`, subject: player.name, roundup: false, status, deal };
  }
  if (teams.length >= 1 && teams.length <= 2 && (TEAM_NEED.test(normalized) || roundup) && !GAME_STORY.test(normalized)) {
    const team = storyTeams[0] ?? teams[0];
    const club = TEAM_BY_ABBR.get(team)?.name ?? team;
    const topic = roundup ? null : teamTopic(normalized);
    return { ...base, teams: [team], relevant: true, type: 'team', subjectKey: topic ? `team-${team.toLowerCase()}-${topic.key}` : `team-${team.toLowerCase()}`, subject: topic ? `${club}: ${topic.label}` : `${club} offseason notes`, roundup, status: null };
  }
  if (GAME_STORY.test(normalized) && !MARKET.test(normalized)) return none;
  if (MARKET.test(normalized) || (roundup && players.length > 0)) {
    const market = MARKET_TOPICS.find(([pattern]) => pattern.test(normalized));
    return { ...base, teams: [], relevant: true, type: 'league', subjectKey: market ? `league-${market[1]}` : 'league-market', subject: market ? market[2] : 'Around the market', roundup, status: null };
  }
  return none;
}

/** Light relevance check for the browser, which has no player list. */
export function looksLikeRumor(text: string): { relevant: boolean; teams: string[] } {
  const normalized = normalizeText(text);
  const teams = findTeams(normalized);
  const relevant =
    !MEDIA.test(normalized) &&
    (LABOR.test(normalized) ||
      MARKET.test(normalized) ||
      TALKS.test(normalized) ||
      INTEREST.test(normalized) ||
      (teams.length > 0 && (AGREEMENT.test(normalized) || MOVE.test(normalized))) ||
      (teams.length > 0 && STAFF_ROLE.test(normalized) && STAFF_ACTION.test(normalized)));
  return { relevant, teams };
}
