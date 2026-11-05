import { describe, expect, it } from 'vitest';
import { buildPlayerIndex, extract, extractDeal, findTeams, looksLikeRumor } from '../../src/core/extract';
import { nameKey, normalizeText } from '../../src/core/text';

const index = buildPlayerIndex(
  [
    { mlbamId: 1, name: 'Tarik Skubal' },
    { mlbamId: 2, name: 'Rudy Martin' },
    { mlbamId: 3, name: 'Tristan Beck' },
    { mlbamId: 4, name: 'José Ramírez' },
    { mlbamId: 5, name: 'J. D. Martinez' },
    { mlbamId: 571970, name: 'Max Muncy' },
    { mlbamId: 691777, name: 'Max Muncy' },
    { mlbamId: 8, name: 'Pete Alonso' },
    { mlbamId: 9, name: 'Zak Kent' },
  ],
  [
    { match: 'Max Muncy', team: 'LAD', mlbamId: 571970, name: 'Max Muncy' },
    { match: 'Max Muncy', team: 'ATH', mlbamId: 691777, name: 'Max Muncy' },
  ],
);
const status = (title: string) => extract(title, index).status;

describe('normalization', () => {
  it('folds diacritics, curly quotes and initials', () => {
    expect(normalizeText('José Ramírez’s deal')).toBe('jose ramirez deal');
    expect(nameKey('J. D. Martinez')).toBe('jd martinez');
    expect(nameKey('Rudy Martin Jr.')).toBe('rudy martin');
    expect(normalizeText("A's sign pitcher")).toBe('athletics sign pitcher');
  });
});

describe('teams', () => {
  it('does not mistake foreign clubs for MLB teams', () => {
    expect(findTeams(normalizeText('Tristan Beck has signed with LG Twins of the KBO'))).toEqual([]);
    expect(findTeams(normalizeText('Pitcher joins Hanshin Tigers'))).toEqual([]);
  });
  it('tells the Sox apart and keeps order of appearance', () => {
    expect(findTeams(normalizeText('White Sox trade with Red Sox'))).toEqual(['CWS', 'BOS']);
  });
  it('ignores other sports', () => {
    expect(findTeams(normalizeText('Giants quarterback signs extension in NFL'))).toEqual([]);
  });
});

describe('status precision: never call speculation a done deal', () => {
  it.each([
    'Could Tarik Skubal sign with the Mets?',
    'Why Tarik Skubal signed with the Mets',
    'Tarik Skubal contract could look similar to Kyle Tucker',
    'Where Mets can turn if Tarik Skubal pursuit fails',
    'Mets likely to sign Tarik Skubal',
    'Predicting landing spots for Tarik Skubal',
    'Mets target Tarik Skubal',
    'Tarik Skubal did not sign with the Mets',
    'Rumors: Mets sign Tarik Skubal?',
  ])('%s', (title) => {
    expect(status(title)).not.toBe('Agreement reported');
  });

  it('labels plain reports', () => {
    expect(status('Rudy Martin Jr. and the Blue Jays agree to minor league deal')).toBe('Agreement reported');
    expect(status('Tristan Beck has signed with LG Twins of the KBO')).toBe('Agreement reported');
    expect(status('Mets acquire Tarik Skubal from Tigers')).toBe('Agreement reported');
    expect(status('Mets, Tarik Skubal in talks on long-term deal')).toBe('Talks');
    expect(status('Yankees nearing deal with Pete Alonso')).toBe('Talks');
    expect(status('Dodgers interested in Pete Alonso')).toBe('Interest');
    expect(status('Talks between Mets and Pete Alonso have ended')).toBe('Fell through');
    expect(status('Mets no longer pursuing Pete Alonso')).toBe('Fell through');
  });
});

describe('item typing', () => {
  it('routes staff, team-need and labor news away from player threads', () => {
    expect(extract('Reds name Joe Torres new pitching coach', index).subjectKey).toBe('staff-cin');
    expect(extract('Tigers hire Kyle Hudson as first base coach', index).type).toBe('staff');
    expect(extract('Marlins seeking an outfield addition', index).subjectKey).toBe('team-mia');
    expect(extract('MLB proposes delaying salary cap until 2028', index).subjectKey).toBe('league-labor');
  });
  it('treats roundups as mentions with no status', () => {
    const result = extract('Mets notes: Pete Alonso, Tarik Skubal and more', index);
    expect(result.roundup).toBe(true);
    expect(result.status).toBeNull();
    expect(result.type).not.toBe('player');
  });
  it('drops media and game stories', () => {
    expect(extract('Weekly podcast: looking ahead to the offseason', index).relevant).toBe(false);
    expect(extract('Tarik Skubal strikes out 12 in win', index).relevant).toBe(false);
  });
  it('keeps moves that are not rumors, without a status claim', () => {
    const result = extract('Zak Kent released by Nationals', index);
    expect(result.type).toBe('player');
    expect(result.status).toBe('Unclassified');
  });
});

describe('shared names', () => {
  it('stays unresolved with no team context', () => {
    const result = extract('Max Muncy signs extension', index);
    expect(result.players).toEqual([]);
    expect(result.ambiguous).toContain('max muncy');
  });
  it('resolves by team context', () => {
    expect(extract('Dodgers sign Max Muncy', index).players[0].mlbamId).toBe(571970);
    expect(extract('Athletics sign Max Muncy', index).players[0].mlbamId).toBe(691777);
  });
});

describe('deal terms', () => {
  it('reads years and money when present', () => {
    expect(extractDeal(normalizeText('Mets sign Pete Alonso to five-year, $150.5M deal'))).toEqual({ years: 5, amountUsd: 150_500_000, minor: false });
    expect(extractDeal(normalizeText('Agree to minor league deal')).minor).toBe(true);
    expect(extract('Yankees sign Pete Alonso to two-year, $40 million deal', index).deal?.amountUsd).toBe(40_000_000);
  });
});

describe('browser relevance check', () => {
  it('passes rumors and rejects game talk', () => {
    expect(looksLikeRumor('Sources: Mets in talks with a free agent reliever').relevant).toBe(true);
    expect(looksLikeRumor('What a great game tonight in Queens').relevant).toBe(false);
  });
});

describe('regressions from live headlines', () => {
  const live = buildPlayerIndex([
    { mlbamId: 10, name: 'Ronald Acuña' },
    { mlbamId: 11, name: 'Roman Anthony' },
    { mlbamId: 12, name: 'Drew Rasmussen' },
    { mlbamId: 13, name: 'William Contreras' },
    { mlbamId: 14, name: 'Nate Eaton' },
    { mlbamId: 15, name: 'Albert Pujols' },
    { mlbamId: 16, name: 'Tarik Skubal' },
  ]);
  it.each([
    '3 reasons Braves should hold on to Ronald Acuña Jr.',
    'Even after injury-marred season, Roman Anthony still looks like a star',
    'Drew Rasmussen to start Game 5 on short rest as Rays try to extend World Series',
    "Brewers' William Contreras gets deserved World Series MVP",
  ])('drops non-rumor story: %s', (title) => {
    expect(extract(title, live).relevant).toBe(false);
  });
  it('reads a trade written as "deal X to Y"', () => {
    expect(extract('In first trade of MLB offseason, Red Sox deal Nate Eaton to Athletics', live).status).toBe('Agreement reported');
  });
  it('routes a managerial hire to staff, not the player', () => {
    expect(extract('Could Astros hire Albert Pujols? Houston to interview him', live).type).not.toBe('player');
    expect(extract("Pujols to interview for Astros' managerial opening, sources say", live).subjectKey).toBe('staff-hou');
  });
  it('does not claim a club link from a ranking', () => {
    expect(extract('Top 40 MLB free agents: Tarik Skubal headlines class light on star power', live).status).toBe('Unclassified');
  });
  it.each([
    "Phillies don't extend qualifying offer to Tarik Skubal as free agency opens",
    'Rays among teams that placed a claim for Tarik Skubal',
    'Hanshin Tigers agree to post Tarik Skubal this winter',
    'Drew Rasmussen to start as Rays try to extend the series',
  ])('is not a done deal: %s', (title) => {
    expect(extract(title, live).status).not.toBe('Agreement reported');
  });
  it.each([
    'Guardians were unable to sign Tarik Skubal',
    'Padres submitted a claim for Tarik Skubal',
    'White Sox interested in a long-term deal with Tarik Skubal',
    'Owner agrees to sell Angels to Tarik Skubal',
  ])('holdout miss is not a done deal: %s', (title) => {
    expect(extract(title, live).status).not.toBe('Agreement reported');
  });
  it('does not read "signature" as a signing', () => {
    expect(extract("The Brewers' signature inning with Tarik Skubal on the mound", live).relevant).toBe(false);
  });
  it('keeps uncertain wording from creating a club link', () => {
    expect(extract('Mets have claimed Tarik Skubal off waivers, not the Rays', live).status).toBe('Unclassified');
    expect(extract("Phillies don't extend qualifying offer to Tarik Skubal", live).status).toBe('Unclassified');
    expect(extract('Could the Mets sign Tarik Skubal?', live).status).toBe('Linked');
  });
  it('only reads a withdrawal as a failed deal when it concerns the deal', () => {
    expect(extract('Mets withdrew offer to Tarik Skubal', live).status).toBe('Fell through');
    expect(extract('Tarik Skubal withdrew from the Classic roster this offseason', live).status).not.toBe('Fell through');
    expect(extract('MLBPA withdrew grievance against Rays involving Tarik Skubal', live).status).not.toBe('Fell through');
  });
  it.each([
    'Fair Territory show! *Rangers notes *Mets moves YouTube: bit.ly/abc Spotify: bit.ly/def',
    'New episode with Tarik Skubal talk on trib.al/xyz',
  ])('drops promos: %s', (title) => {
    expect(extract(title, live).relevant).toBe(false);
  });
  it('does not treat a prediction as a club link', () => {
    expect(extract('Pirates predicted to sign Tarik Skubal', live).status).toBe('Unclassified');
    expect(extract('Mets could sign Tarik Skubal', live).status).toBe('Linked');
  });
  it('drops vague roundups and offseason chatter', () => {
    expect(extract('Guardians News: Not Much Going On', live).relevant).toBe(false);
    expect(extract('View From The Other Offseason with a guest', live).relevant).toBe(false);
  });
  it('uses full club names and team-site context', () => {
    expect(extract('Reds name new pitching coach', live).subject).toBe('Cincinnati Reds staff and front office');
    expect(extract('Free agent target: Tarik Skubal', live, 'CHC').teams).toEqual(['CHC']);
  });
  it('sends a one-team news roundup to that team', () => {
    expect(extract('Mariners News: Jason Kanzler, Cam Castro, and Albert Pujols', live).subjectKey).toBe('team-sea');
  });
});
