import { describe, expect, it } from 'vitest';
import { buildPlayerIndex } from '../../src/core/extract';
import { emptyState, stateSchema } from '../../src/core/schemas';
import { loadFeeds, loadReporters, publishableFeeds, publishableReporters } from '../../src/pipeline/config';
import { TEAM_BY_ABBR } from '../../src/core/teams';
import { canonicalUrl, fetchFeed, parseBlueskyFeed, parseFeedEntries, type RawEntry } from '../../src/pipeline/fetch';
import { parseRegister } from '../../src/pipeline/players';
import { isAllowedByRobots } from '../../src/pipeline/robots';
import { applyGates, applyOverrides, buildLatest, mergeEntries, nextStatus, shouldPublish } from '../../src/pipeline/threads';

const now = new Date('2026-11-05T12:00:00Z');
const open = { agreement_reported: true, fell_through: true };
const noOverrides = { threads: {}, items: { hide: [] as string[] } };
const index = buildPlayerIndex([
  { mlbamId: 1, name: 'Tarik Skubal' },
  { mlbamId: 2, name: 'Pete Alonso' },
]);
const entry = (title: string, url = `https://example.com/${encodeURIComponent(title)}`, extra: Partial<RawEntry> = {}): RawEntry => ({
  sourceId: 'espn',
  sourceName: 'ESPN',
  sourceKind: 'news',
  title,
  url,
  publishedAt: '2026-11-05T10:00:00Z',
  scanText: '',
  ...extra,
});
const merge = (entries: RawEntry[], gates = open, state = emptyState(now.toISOString())) => mergeEntries(state, entries, { index, gates, overrides: noOverrides, now });

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://example.com</link>
<item><title>Mets sign Pete Alonso</title><link>https://example.com/a?utm_source=x</link><pubDate>Thu, 05 Nov 2026 10:00:00 GMT</pubDate><description>SECRET ARTICLE BODY about Tarik Skubal</description></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
<item><title><![CDATA[<img src=x onerror=alert(1)> Mets acquire Pete Alonso]]></title><link>https://example.com/x</link></item>
</channel></rss>`;

describe('feed parsing', () => {
  it('rejects non-https links and strips tracking', () => {
    const entries = parseFeedEntries(RSS, { id: 'x', name: 'X' }, now);
    expect(entries.map((e) => e.url)).toEqual(['https://example.com/a', 'https://example.com/x']);
    expect(canonicalUrl('https://a.com/b?utm_medium=z&id=1#f')).toBe('https://a.com/b?id=1');
  });
  it('decodes double-encoded entities in titles', () => {
    const xml = RSS.replace('Mets sign Pete Alonso', 'Phillies don&amp;#39;t sign Pete &amp;amp; Co');
    expect(parseFeedEntries(xml, { id: 'x', name: 'X' }, now)[0].title).toBe("Phillies don't sign Pete & Co");
  });
  it('survives a broken feed and reports it', async () => {
    const feed = { id: 'x', name: 'X', url: 'https://example.com/feed', reviewed: true };
    const fake = async (url: string) => (String(url).endsWith('robots.txt') ? new Response('') : new Response('<nope', { status: 200 }));
    const result = await fetchFeed(feed, undefined, now, fake);
    expect(result.entries).toEqual([]);
    expect(result.health.lastError).toBeTruthy();
  });
  it('reports an empty 202 as blocked', async () => {
    const feed = { id: 'w', name: 'W', url: 'https://walled.example/feed', reviewed: true };
    const fake = async (url: string) => (String(url).endsWith('robots.txt') ? new Response('') : new Response('', { status: 202 }));
    const result = await fetchFeed(feed, undefined, now, fake);
    expect(result.entries).toEqual([]);
    expect(result.health.lastError).toMatch(/blocked by source/);
  });
  it('honors robots.txt without fetching the feed', async () => {
    const feed = { id: 'r', name: 'R', url: 'https://blocked.example/feed', reviewed: true };
    let calls = 0;
    const fake = async (url: string) => {
      if (String(url).endsWith('robots.txt')) return new Response('User-agent: *\nDisallow: /feed');
      calls += 1;
      return new Response(RSS);
    };
    expect((await fetchFeed(feed, undefined, now, fake)).health.lastError).toMatch(/robots/);
    expect(calls).toBe(0);
  });
  it('treats 304 as success', async () => {
    const feed = { id: 'c', name: 'C', url: 'https://cached.example/feed', reviewed: true };
    const fake = async (url: string) => (String(url).endsWith('robots.txt') ? new Response('') : new Response(null, { status: 304 }));
    const result = await fetchFeed(feed, { id: 'c', name: 'C', lastSuccessAt: null, lastError: null, etag: 'abc' }, now, fake);
    expect(result.health.lastSuccessAt).toBe(now.toISOString());
    expect(result.health.etag).toBe('abc');
  });
});

describe('robots rules', () => {
  it('applies the wildcard group and longest match', () => {
    const body = 'User-agent: bad\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/ok\n';
    expect(isAllowedByRobots(body, '/feed')).toBe(true);
    expect(isAllowedByRobots(body, '/private/x')).toBe(false);
    expect(isAllowedByRobots(body, '/private/ok')).toBe(true);
  });
});

describe('source gating', () => {
  it('keeps unreviewed sources and pending identities out of published builds', () => {
    const feeds = [{ id: 'a', name: 'A', url: 'https://a.com', reviewed: true }, { id: 'b', name: 'B', url: 'https://b.com', reviewed: false }];
    expect(publishableFeeds(feeds, false).map((f) => f.id)).toEqual(['a']);
    expect(publishableFeeds(feeds, true)).toHaveLength(2);
    expect(publishableFeeds([{ ...feeds[0], excluded: true }], true)).toEqual([]);
    const reporters = [{ handle: 'a', name: 'A', identity: 'verified' as const }, { handle: 'b', name: 'B', identity: 'pending' as const }];
    expect(publishableReporters(reporters, false).map((r) => r.handle)).toEqual(['a']);
  });
});

describe('shipped source config', () => {
  it('never runs an excluded source, even locally', () => {
    const ids = publishableFeeds(loadFeeds(), true).map((f) => f.id);
    for (const id of ['espn', 'athletic', 'mlbcom', 'nypost', 'cbs']) expect(ids).not.toContain(id);
    expect(ids).toContain('yahoo');
  });
  it('covers every club with exactly one team site', () => {
    const teams = publishableFeeds(loadFeeds(), false).filter((f) => f.kind === 'fansite').map((f) => f.team);
    expect(new Set(teams).size).toBe(30);
    expect(teams).toHaveLength(30);
    for (const team of teams) expect(TEAM_BY_ABBR.has(team as string)).toBe(true);
  });
  it('keeps unconfirmed reporters out of published builds', () => {
    const published = publishableReporters(loadReporters(), false).map((r) => r.handle);
    expect(published).toContain('ken-rosenthal.bsky.social');
    expect(published).not.toContain('bnightengale.bsky.social');
  });
});

describe('thread merging', () => {
  it('keeps one thread per player across sources, in order', () => {
    const state = merge([
      entry('Dodgers interested in Pete Alonso'),
      entry('Mets in talks with Pete Alonso', undefined, { sourceId: 'y', sourceName: 'Yahoo', publishedAt: '2026-11-05T11:00:00Z' }),
    ]);
    const thread = state.threads['player-2'];
    expect(thread.items).toHaveLength(2);
    expect(thread.status).toBe('Talks');
    expect(thread.teams.sort()).toEqual(['LAD', 'NYM']);
    expect(thread.items[0].sourceName).toBe('Yahoo');
  });
  it('is idempotent and dedupes syndicated titles', () => {
    const items = [entry('Mets sign Pete Alonso', 'https://a.com/1'), entry('Mets sign Pete Alonso', 'https://b.com/2')];
    const state = merge(items);
    merge(items, open, state);
    expect(state.threads['player-2'].items).toHaveLength(1);
  });
  it('gated labels fall back to Unclassified, with no deal recorded', () => {
    const state = merge([entry('Mets sign Pete Alonso to two-year, $40M deal')], { agreement_reported: false, fell_through: false });
    expect(state.threads['player-2'].status).toBe('Unclassified');
    expect(state.deals).toEqual([]);
    expect(applyGates('Talks', { agreement_reported: false, fell_through: false })).toBe('Talks');
  });
  it('records deals when the label is open', () => {
    const state = merge([entry('Mets sign Pete Alonso to two-year, $40M deal')]);
    expect(state.deals[0]).toMatchObject({ player: 'Pete Alonso', years: 2, amountUsd: 40_000_000, teams: ['NYM'] });
  });
  it('only lets feed text add mentions, never store it or change status', () => {
    const state = merge([entry('Mets sign Pete Alonso', undefined, { scanText: 'SECRET ARTICLE BODY about Tarik Skubal who signed' })]);
    const mention = state.threads['player-1'];
    expect(mention.items[0].role).toBe('mention');
    expect(mention.status).toBeNull();
    expect(JSON.stringify(state)).not.toContain('SECRET');
  });
  it('does not let mentions or other clubs widen a thread', () => {
    const state = merge([
      entry('Mets sign Pete Alonso', undefined, { scanText: 'Tarik Skubal' }),
      entry('Dodgers Notes: Tarik Skubal, Pete Alonso, depth'),
      entry('Astros interview Brewers exec for manager job'),
    ]);
    expect(state.threads['player-1'].teams).toEqual([]);
    expect(state.threads['staff-hou'].teams).toEqual(['HOU']);
  });
  it('never lets a fan site change a status or log a deal', () => {
    const fan = { sourceId: 'sbn-nym', sourceName: 'Fan Site', sourceKind: 'fansite' as const, team: 'NYM' };
    const state = merge([entry('Mets sign Pete Alonso to two-year, $40M deal', undefined, fan)]);
    expect(state.threads['player-2'].status).toBeNull();
    expect(state.deals).toEqual([]);
    expect(state.threads['player-2'].teams).toEqual(['NYM']);
  });
  it('uses the team site as context, and leads with reporting over fan sites', () => {
    const fan = { sourceId: 'sbn-chc', sourceName: 'Fan Site', sourceKind: 'fansite' as const, team: 'CHC', publishedAt: '2026-11-05T11:30:00Z' };
    const state = merge([entry('Free agent target: Pete Alonso', 'https://a.com/fan', fan), entry('Dodgers interested in Pete Alonso', 'https://a.com/news')]);
    expect(state.threads['player-2'].teams).toContain('CHC');
    expect(buildLatest(Object.values(state.threads), now.toISOString()).threads[0].top.sourceName).toBe('ESPN');
  });
  it('reads only the headline from a fan site feed', () => {
    const [first] = parseFeedEntries(RSS, { id: 'x', name: 'X', kind: 'fansite', team: 'CHC' }, now);
    expect(first.scanText).toBe('');
    expect(first.sourceKind).toBe('fansite');
    expect(first.team).toBe('CHC');
  });
  it('ignores old, future and undated entries', () => {
    const state = merge([
      entry('Mets sign Pete Alonso', 'https://a.com/old', { publishedAt: '2025-01-01T00:00:00Z' }),
      entry('Mets sign Tarik Skubal', 'https://a.com/future', { publishedAt: '2027-01-01T00:00:00Z' }),
      entry('Dodgers sign Tarik Skubal', 'https://a.com/bad', { publishedAt: 'nope' }),
    ]);
    expect(Object.keys(state.threads)).toEqual([]);
  });
  it('produces state that passes the schema', () => {
    expect(() => stateSchema.parse(merge([entry('Mets sign Pete Alonso')]))).not.toThrow();
  });
});

describe('publishing cadence', () => {
  it('publishes on change, first run, and hourly, but not on every quiet run', () => {
    expect(shouldPublish(true, '2026-11-05T11:59:00Z', now)).toBe(true);
    expect(shouldPublish(false, null, now)).toBe(true);
    expect(shouldPublish(false, '2026-11-05T11:50:00Z', now)).toBe(false);
    expect(shouldPublish(false, '2026-11-05T10:59:00Z', now)).toBe(true);
  });
});

describe('status movement', () => {
  it('does not regress a reported deal, but reopens after one falls through', () => {
    expect(nextStatus('Agreement reported', 'Interest')).toBe('Agreement reported');
    expect(nextStatus('Talks', 'Fell through')).toBe('Fell through');
    expect(nextStatus('Fell through', 'Interest')).toBe('Interest');
    expect(nextStatus('Talks', 'Unclassified')).toBe('Talks');
  });
});

describe('output', () => {
  it('applies overrides without losing underlying data', () => {
    const state = merge([entry('Dodgers interested in Pete Alonso')]);
    const thread = state.threads['player-2'];
    expect(applyOverrides([thread], { threads: { 'player-2': { hidden: true } }, items: { hide: [] } })).toEqual([]);
    expect(applyOverrides([thread], { threads: { 'player-2': { status: 'Unclassified' } }, items: { hide: [] } })[0].status).toBe('Unclassified');
    expect(applyOverrides([thread], { threads: {}, items: { hide: [thread.items[0].id] } })).toEqual([]);
    expect(thread.items).toHaveLength(1);
  });
  it('keeps mention-only players off the board', () => {
    const state = merge([entry('Mets sign Pete Alonso', undefined, { scanText: 'Tarik Skubal' })]);
    expect(buildLatest(Object.values(state.threads), now.toISOString()).threads.map((t) => t.id)).toEqual(['player-2']);
  });
});

describe('external data parsing', () => {
  it('builds safe Bluesky links and skips reposts', () => {
    const reporter = { handle: 'a.bsky.social', name: 'A', identity: 'verified' as const };
    const entries = parseBlueskyFeed(
      {
        feed: [
          { post: { uri: 'at://did/app.bsky.feed.post/abc123', record: { text: 'Mets in talks', createdAt: '2026-11-05T10:00:00Z' } } },
          { reason: {}, post: { uri: 'at://did/app.bsky.feed.post/repost', record: { text: 'repost' } } },
          { post: { uri: 'at://did/app.bsky.feed.post/e"vil', record: { text: 'x' } } },
        ],
      },
      reporter,
      now,
    );
    expect(entries.map((e) => e.url)).toEqual(['https://bsky.app/profile/a.bsky.social/post/abc123']);
  });
  it('keeps only recent people with MLB ids from the register', () => {
    const csv = 'key_mlbam,name_first,name_last,mlb_played_last,pro_played_last\n1,Old,Timer,1950,1950\n2,Now,Player,2026,2026\n,No,Id,2026,2026\n3,"Quoted, Jr",Name,,2025\n';
    expect(parseRegister(csv, 2026).map((p) => p.mlbamId)).toEqual([2, 3]);
  });
});
