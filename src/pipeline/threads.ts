import { createHash } from 'node:crypto';
import { buildPlayerIndex, extract, findPlayers, type Extraction, type PlayerIndex } from '../core/extract';
import type { Item, Latest, State, Status, Thread, ThreadSummary } from '../core/schemas';
import { normalizeText } from '../core/text';
import type { Gates, Overrides } from './config';
import type { RawEntry } from './fetch';

const MAX_AGE_DAYS = 30;
const MAX_ITEMS_PER_THREAD = 100;
const MAX_MENTIONS_PER_ITEM = 8;
const TITLE_DEDUPE_MS = 3 * 86_400_000;
const LATEST_LIMIT = 400;

const RANK: Record<Status, number> = { Unclassified: 0, Linked: 1, Interest: 2, Talks: 3, 'Agreement reported': 4, 'Fell through': 4 };

export const itemId = (url: string): string => createHash('sha1').update(url).digest('hex').slice(0, 16);

/** Labels that haven't passed the evaluation gate are reported as Unclassified. */
export function applyGates(status: Status | null, gates: Gates): Status | null {
  if (status === 'Agreement reported' && !gates.agreement_reported) return 'Unclassified';
  if (status === 'Fell through' && !gates.fell_through) return 'Unclassified';
  return status;
}

/** A reported deal outranks earlier chatter; only a reopening after "Fell through" moves down. */
export function nextStatus(current: Status | null, incoming: Status | null): Status | null {
  if (incoming === null || incoming === 'Unclassified') return current ?? incoming;
  if (current === null || current === 'Unclassified' || current === 'Fell through') return incoming;
  if (incoming === 'Fell through') return incoming;
  return RANK[incoming] >= RANK[current] ? incoming : current;
}

function upsert(state: State, key: string, type: Thread['type'], subject: string, mlbamId: number | null, now: string, ownTeam?: string): Thread {
  const existing = state.threads[key];
  if (existing) return existing;
  const created: Thread = { id: key, type, subject, mlbamId, teams: ownTeam ? [ownTeam] : [], status: null, statusAt: null, firstSeenAt: now, lastActivityAt: now, items: [] };
  state.threads[key] = created;
  return created;
}

function addItem(thread: Thread, item: Item): void {
  if (thread.items.some((existing) => existing.id === item.id)) return;
  thread.items.push(item);
  thread.items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  thread.items = thread.items.slice(0, MAX_ITEMS_PER_THREAD);
  // Only a player's own reports name their clubs. Mentions would widen the list and
  // risk a false Official match; team and staff threads keep their one club.
  if (thread.type === 'player' && item.role === 'primary') {
    for (const team of item.teams) if (!thread.teams.includes(team)) thread.teams.push(team);
  }
  if (item.firstSeenAt > thread.lastActivityAt) thread.lastActivityAt = item.firstSeenAt;
  if (thread.type === 'player' && item.role === 'primary') {
    const next = nextStatus(thread.status, item.status);
    if (next !== thread.status) {
      thread.status = next;
      thread.statusAt = item.firstSeenAt;
    }
  }
}

export interface MergeOptions {
  index: PlayerIndex;
  gates: Gates;
  overrides: Overrides;
  now: Date;
}

export function mergeEntries(state: State, entries: RawEntry[], options: MergeOptions): State {
  const { index, gates, overrides, now } = options;
  const nowIso = now.toISOString();
  const floor = now.getTime() - MAX_AGE_DAYS * 86_400_000;
  const seenIds = new Set<string>();
  const recentTitles = new Map<string, number>();
  for (const thread of Object.values(state.threads)) {
    for (const item of thread.items) {
      seenIds.add(item.id);
      recentTitles.set(normalizeText(item.title), Date.parse(item.publishedAt));
    }
  }

  for (const entry of entries) {
    const id = itemId(entry.url);
    const published = Date.parse(entry.publishedAt);
    if (seenIds.has(id) || Number.isNaN(published) || published < floor || published > now.getTime() + 3_600_000) continue;
    if (overrides.items.hide.includes(id)) continue;
    const titleKey = normalizeText(entry.title);
    const priorTitle = recentTitles.get(titleKey);
    if (priorTitle !== undefined && Math.abs(priorTitle - published) < TITLE_DEDUPE_MS) continue;

    const found: Extraction = extract(entry.title, index, entry.team);
    if (!found.relevant || !found.subjectKey || !found.type || !found.subject) continue;
    seenIds.add(id);
    recentTitles.set(titleKey, published);

    // Fan sites are opinion and analysis, so they can never move a player's status.
    const status = entry.sourceKind === 'fansite' ? null : applyGates(found.status, gates);
    const common = {
      id,
      title: entry.title,
      url: entry.url,
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      sourceKind: entry.sourceKind,
      ...(entry.author ? { author: entry.author } : {}),
      publishedAt: new Date(published).toISOString(),
      firstSeenAt: nowIso,
      teams: found.teams,
    } satisfies Omit<Item, 'role' | 'status'>;

    const primary = upsert(state, found.subjectKey, found.type, found.subject, found.type === 'player' ? found.players[0].mlbamId : null, nowIso, found.type === 'team' || found.type === 'staff' ? found.teams[0] : undefined);
    addItem(primary, { ...common, role: 'primary', status });

    if (found.type === 'player' && found.deal && status === 'Agreement reported') {
      state.deals.unshift({
        threadId: primary.id,
        player: primary.subject,
        teams: found.teams,
        years: found.deal.years,
        amountUsd: found.deal.amountUsd,
        minor: found.deal.minor,
        title: entry.title,
        url: entry.url,
        sourceName: entry.sourceName,
        at: common.publishedAt,
      });
    }

    const mentioned = new Map(found.players.map((player) => [player.mlbamId, player]));
    for (const player of findPlayers(normalizeText(entry.scanText), found.teams, index).players) mentioned.set(player.mlbamId, player);
    let count = 0;
    for (const player of mentioned.values()) {
      const key = `player-${player.mlbamId}`;
      if (key === found.subjectKey) continue;
      if (count >= MAX_MENTIONS_PER_ITEM) break;
      count += 1;
      addItem(upsert(state, key, 'player', player.name, player.mlbamId, nowIso), { ...common, role: 'mention', status: null });
    }
  }
  state.updatedAt = nowIso;
  return state;
}

/** Overrides apply to the output only, so removing one restores the thread. */
export function applyOverrides(threads: Thread[], overrides: Overrides): Thread[] {
  const out: Thread[] = [];
  for (const thread of threads) {
    const rule = overrides.threads[thread.id];
    if (rule?.hidden) continue;
    const items = thread.items.filter((item) => !overrides.items.hide.includes(item.id));
    if (items.length === 0) continue;
    out.push({ ...thread, items, status: (rule?.status as Status | undefined) ?? thread.status });
  }
  return out;
}

export function summarize(thread: Thread): ThreadSummary {
  const primaries = thread.items.filter((item) => item.role === 'primary');
  // Lead with reporting over fan sites when a thread has both.
  const primary = primaries.find((item) => item.sourceKind !== 'fansite') ?? primaries[0] ?? thread.items[0];
  return {
    id: thread.id,
    type: thread.type,
    subject: thread.subject,
    mlbamId: thread.mlbamId,
    teams: thread.teams,
    status: thread.status,
    firstSeenAt: thread.firstSeenAt,
    lastActivityAt: thread.lastActivityAt,
    itemCount: thread.items.length,
    sourceCount: new Set(thread.items.map((item) => item.sourceName)).size,
    top: { title: primary.title, url: primary.url, sourceName: primary.sourceName, at: primary.publishedAt },
  };
}

/** A thread made only of passing mentions stays off the board but keeps its page. */
export function buildLatest(threads: Thread[], now: string): Latest {
  const onBoard = threads.filter((thread) => thread.type !== 'player' || thread.items.some((item) => item.role === 'primary'));
  const sorted = [...onBoard].sort((a, b) => b.items[0].publishedAt.localeCompare(a.items[0].publishedAt));
  return { version: 1, generatedAt: now, threads: sorted.slice(0, LATEST_LIMIT).map(summarize) };
}

/** Publish on new content, and at least hourly so timestamps show the site is alive. */
export function shouldPublish(threadsChanged: boolean, previousUpdatedAt: string | null, now: Date): boolean {
  if (threadsChanged || previousUpdatedAt === null) return true;
  return now.getTime() - Date.parse(previousUpdatedAt) >= 55 * 60_000;
}

export { buildPlayerIndex };
