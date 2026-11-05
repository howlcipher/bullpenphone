import { parseFeed } from '@rowanmanning/feed-parser';
import { isHttpsUrl, type SourceHealth } from '../core/schemas';
import type { Feed, Reporter } from './config';
import { isAllowedByRobots } from './robots';

const USER_AGENT = 'bullpenphone-bot/0.1 (+https://github.com/howlcipher/bullpenphone)';
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 8_000_000;

/**
 * One fetched entry. `scanText` is used in memory to find player mentions. It is
 * never copied to the stored Item, so article text cannot reach state or the site.
 */
export interface RawEntry {
  sourceId: string;
  sourceName: string;
  sourceKind: 'news' | 'reporter';
  title: string;
  url: string;
  author?: string;
  publishedAt: string;
  scanText: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201C', rdquo: '\u201D', ndash: '\u2013', mdash: '\u2014', hellip: '\u2026' };

/** Some feeds double-encode entities. Decoded text is still rendered escaped by the site. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    const value = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole;
  });
}

const cleanTitle = (input: string): string => decodeEntities(input).replace(/\s+/g, ' ').trim();

export function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|ex_cid|cmp|cid|ref$|src$|smid|partner)/i.test(key)) parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

export function parseFeedEntries(xml: string, feed: Pick<Feed, 'id' | 'name'>, now: Date): RawEntry[] {
  const parsed = parseFeed(xml);
  const out: RawEntry[] = [];
  for (const item of parsed.items) {
    const title = cleanTitle(item.title ?? '');
    const url = item.url ?? '';
    if (!title || title.length > 600 || !isHttpsUrl(url)) continue;
    const when = item.published ?? item.updated ?? now;
    out.push({
      sourceId: feed.id,
      sourceName: feed.name,
      sourceKind: 'news',
      title,
      url: canonicalUrl(url),
      author: item.authors?.[0]?.name ?? undefined,
      publishedAt: when.toISOString(),
      scanText: `${item.description ?? ''} ${item.content ?? ''}`.replace(/<[^>]*>/g, ' ').slice(0, 20_000),
    });
  }
  return out;
}

async function readCapped(response: Response): Promise<string> {
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error('response too large');
  return text;
}

const robotsCache = new Map<string, string>();

async function allowedByRobots(url: string, fetcher: FetchLike): Promise<boolean> {
  const parsed = new URL(url);
  let body = robotsCache.get(parsed.origin);
  if (body === undefined) {
    try {
      const response = await fetcher(`${parsed.origin}/robots.txt`, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      body = response.ok ? await readCapped(response) : '';
    } catch {
      body = '';
    }
    robotsCache.set(parsed.origin, body);
  }
  return isAllowedByRobots(body, `${parsed.pathname}${parsed.search}`);
}

export interface FetchResult {
  entries: RawEntry[];
  health: SourceHealth;
}

export async function fetchFeed(feed: Feed, previous: SourceHealth | undefined, now: Date, fetcher: FetchLike = fetch): Promise<FetchResult> {
  const base: SourceHealth = {
    id: feed.id,
    name: feed.name,
    lastSuccessAt: previous?.lastSuccessAt ?? null,
    lastError: null,
    ...(previous?.etag ? { etag: previous.etag } : {}),
    ...(previous?.lastModified ? { lastModified: previous.lastModified } : {}),
  };
  try {
    if (!(await allowedByRobots(feed.url, fetcher))) throw new Error('disallowed by robots.txt');
    const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' };
    if (previous?.etag) headers['if-none-match'] = previous.etag;
    if (previous?.lastModified) headers['if-modified-since'] = previous.lastModified;
    const response = await fetcher(feed.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 304) return { entries: [], health: { ...base, lastSuccessAt: now.toISOString() } };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await readCapped(response);
    // Some sources answer automated clients with an empty body. Report it and move on.
    if (response.status === 202 || body.trim() === '') throw new Error(`blocked by source (HTTP ${response.status}, empty response)`);
    const entries = parseFeedEntries(body, feed, now);
    const etag = response.headers.get('etag') ?? undefined;
    const lastModified = response.headers.get('last-modified') ?? undefined;
    return {
      entries,
      health: {
        id: feed.id,
        name: feed.name,
        lastSuccessAt: now.toISOString(),
        lastError: null,
        ...(etag ? { etag } : {}),
        ...(lastModified ? { lastModified } : {}),
      },
    };
  } catch (error) {
    return { entries: [], health: { ...base, lastError: error instanceof Error ? error.message : String(error) } };
  }
}

interface BlueskyPost {
  uri?: string;
  indexedAt?: string;
  author?: { handle?: string };
  record?: { text?: string; createdAt?: string };
  embed?: { external?: { title?: string; description?: string } };
}

export function parseBlueskyFeed(json: unknown, reporter: Reporter, now: Date): RawEntry[] {
  const feed = (json as { feed?: Array<{ post?: BlueskyPost; reason?: unknown }> }).feed ?? [];
  const out: RawEntry[] = [];
  for (const entry of feed) {
    if (entry.reason) continue;
    const post = entry.post;
    const text = cleanTitle(post?.record?.text ?? '');
    const external = post?.embed?.external;
    const title = text || cleanTitle(external?.title ?? '');
    const rkey = post?.uri?.split('/').pop();
    if (!title || !rkey || !/^[a-z0-9]+$/i.test(rkey)) continue;
    out.push({
      sourceId: `bsky-${reporter.handle}`,
      sourceName: reporter.name,
      sourceKind: 'reporter',
      title: title.slice(0, 600),
      url: `https://bsky.app/profile/${reporter.handle}/post/${rkey}`,
      author: reporter.name,
      publishedAt: post?.record?.createdAt ?? post?.indexedAt ?? now.toISOString(),
      scanText: `${external?.title ?? ''} ${external?.description ?? ''}`,
    });
  }
  return out;
}

export async function fetchReporter(reporter: Reporter, previous: SourceHealth | undefined, now: Date, fetcher: FetchLike = fetch): Promise<FetchResult> {
  const id = `bsky-${reporter.handle}`;
  const base: SourceHealth = { id, name: reporter.name, lastSuccessAt: previous?.lastSuccessAt ?? null, lastError: null };
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(reporter.handle)}&limit=30&filter=posts_no_replies`;
    const response = await fetcher(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { entries: parseBlueskyFeed(await response.json(), reporter, now), health: { ...base, lastSuccessAt: now.toISOString() } };
  } catch (error) {
    return { entries: [], health: { ...base, lastError: error instanceof Error ? error.message : String(error) } };
  }
}
