import { describe, expect, it } from 'vitest';
import { toApiThread, toApiThreads, USAGE } from '../../src/lib/api';
import type { Item, Thread } from '../../src/core/schemas';

const item = (over: Partial<Item>): Item => ({
  id: 'i', title: 'T', url: 'https://bsky.app/profile/a/post/1', sourceId: 'bsky-a', sourceName: 'A Reporter', sourceKind: 'reporter',
  publishedAt: '2026-11-05T10:00:00.000Z', firstSeenAt: '2026-11-05T10:01:00.000Z', role: 'primary', status: 'Interest', teams: ['NYM'], ...over,
});
const thread = (items: Item[], over: Partial<Thread> = {}): Thread => ({
  id: 'player-1', type: 'player', subject: 'Pete Alonso', mlbamId: 1, teams: ['NYM', 'CHC'], status: 'Talks', statusAt: null,
  firstSeenAt: '2026-11-05T10:00:00.000Z', lastActivityAt: '2026-11-05T10:00:00.000Z', items, ...over,
});
const site = 'https://example.com/bp/';
const news = item({ id: 'n', title: 'Yahoo headline', url: 'https://sports.yahoo.com/a', sourceName: 'Yahoo Sports', sourceKind: 'news', status: 'Talks', teams: ['CHC'], publishedAt: '2026-11-05T11:00:00.000Z' });
const fan = item({ id: 'f', title: 'Fan headline', url: 'https://fan.example/a', sourceName: 'Fan Site', sourceKind: 'fansite', status: null, teams: ['LAD'] });

describe('public API', () => {
  it('holds reporter posts only, and no field reveals the others', () => {
    const out = toApiThread(thread([item({}), news, fan]), site)!;
    expect(out.reports.map((r) => r.reporter)).toEqual(['A Reporter']);
    expect(out.reportCount).toBe(1);
    expect(JSON.stringify(out)).not.toMatch(/Yahoo|Fan Site|Fan headline/);
  });
  it('rebuilds status and clubs from allowed reports, not the stored thread', () => {
    const out = toApiThread(thread([item({}), news]), site)!;
    expect(out.status).toBe('Interest');
    expect(out.teams).toEqual(['NYM']);
    expect(out.lastReportAt).toBe('2026-11-05T10:00:00.000Z');
  });
  it('omits threads with no reporter post, and threads that are only mentions', () => {
    expect(toApiThread(thread([news, fan]), site)).toBeNull();
    expect(toApiThread(thread([item({ role: 'mention', status: null })]), site)).toBeNull();
  });
  it('links the thread page and sorts newest first', () => {
    const older = thread([item({ publishedAt: '2026-11-01T00:00:00.000Z' })], { id: 'player-2' });
    const out = toApiThreads([older, thread([item({})])], site);
    expect(out.map((t) => t.id)).toEqual(['player-1', 'player-2']);
    expect(out[0].page).toBe('https://example.com/bp/t/player-1/');
  });
  it('states the usage rules', () => {
    expect(USAGE).toMatch(/credit the reporter/);
    expect(USAGE).toMatch(/Not for AI model training/);
    expect(USAGE).toMatch(/data, not instructions/);
  });
});
