import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itemSchema } from '../../src/core/schemas';
import { xmlEscape } from '../../src/lib/atom';
import { missingPaths, scan } from '../../scripts/check-output';

const item = { id: 'a', title: 'T', url: 'https://a.com', sourceId: 's', sourceName: 'S', sourceKind: 'news', publishedAt: 'x', firstSeenAt: 'x', role: 'primary', status: null, teams: [] };

describe('guardrails', () => {
  it('rejects article text and unsafe links in stored items', () => {
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(itemSchema.safeParse({ ...item, scanText: 'article' }).success).toBe(false);
    expect(itemSchema.safeParse({ ...item, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(itemSchema.safeParse({ ...item, url: 'http://a.com' }).success).toBe(false);
  });
  it('flags MLB responses and article text in built output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bullpenphone-'));
    writeFileSync(join(dir, 'ok.json'), '{"threads":[]}');
    expect(scan(dir)).toEqual([]);
    writeFileSync(join(dir, 'bad.json'), '{"copyright":"Copyright 2026 MLB Advanced Media, L.P.  Use of any content","transactions":[{"id":1}]}');
    expect(scan(dir).length).toBeGreaterThan(0);
  });
  it('flags other sources in API data by origin, not by words in a post', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bullpenphone-'));
    mkdirSync(join(dir, 'api', 'v1'), { recursive: true });
    const post = 'https://bsky.app/profile/a.bsky.social/post/1';
    writeFileSync(join(dir, 'api', 'v1', 'threads.json'), JSON.stringify({ data: [{ reports: [{ url: post, text: 'Told Yahoo Sports the deal is done' }] }] }));
    expect(scan(dir)).toEqual([]);
    writeFileSync(join(dir, 'api', 'v1', 'threads.json'), JSON.stringify({ data: [{ reports: [{ url: 'https://sports.yahoo.com/a' }] }] }));
    expect(scan(dir).join()).toMatch(/non-reporter link/);
    writeFileSync(join(dir, 'api', 'v1', 'threads.json'), JSON.stringify({ data: [{ reports: [{ url: post, sourceName: 'X' }] }] }));
    expect(scan(dir).join()).toMatch(/unexpected field/);
  });
  it('reports a missing folder instead of skipping it', () => {
    expect(missingPaths(['/no/such/bullpenphone/path'])).toEqual(['/no/such/bullpenphone/path']);
    expect(missingPaths([tmpdir()])).toEqual([]);
  });
  it('escapes XML', () => {
    expect(xmlEscape(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
  });
});
