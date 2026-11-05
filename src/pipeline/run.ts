import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPlayerIndex } from '../core/extract';
import { emptyState, latestSchema, stateSchema, type State } from '../core/schemas';
import { loadAliases, loadFeeds, loadGates, loadOverrides, loadReporters, publishableFeeds, publishableReporters } from './config';
import { fetchFeed, fetchReporter, type FetchResult } from './fetch';
import { loadPlayers } from './players';
import { applyOverrides, buildLatest, mergeEntries, shouldPublish } from './threads';

const dataDir = resolve(process.env.DATA_DIR ?? '.data');
const includeUnreviewed = process.env.HOTSTOVE_INCLUDE_UNREVIEWED === '1';

function loadState(now: string): State {
  const path = join(dataDir, 'state.json');
  if (!existsSync(path)) return emptyState(now);
  return stateSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

const canonical = (value: unknown): string => JSON.stringify(value, null, 1);

async function main(): Promise<void> {
  mkdirSync(dataDir, { recursive: true });
  const now = new Date();
  const nowIso = now.toISOString();
  const state = loadState(nowIso);
  const before = canonical(state.threads);
  const previousUpdatedAt = existsSync(join(dataDir, 'state.json')) ? state.updatedAt : null;

  const players = await loadPlayers(dataDir, now);
  const index = buildPlayerIndex(players, loadAliases());
  const gates = loadGates();
  const overrides = loadOverrides();
  const feeds = publishableFeeds(loadFeeds(), includeUnreviewed);
  const reporters = publishableReporters(loadReporters(), includeUnreviewed);

  const results: FetchResult[] = await Promise.all([
    ...feeds.map((feed) => fetchFeed(feed, state.health[feed.id], now)),
    ...reporters.map((reporter) => fetchReporter(reporter, state.health[`bsky-${reporter.handle}`], now)),
  ]);
  for (const result of results) state.health[result.health.id] = result.health;

  mergeEntries(state, results.flatMap((result) => result.entries), { index, gates, overrides, now });
  const threads = applyOverrides(Object.values(state.threads), overrides);
  const latest = buildLatest(threads, nowIso);

  stateSchema.parse(state);
  latestSchema.parse(latest);
  writeFileSync(join(dataDir, 'state.json'), `${canonical(state)}\n`);
  writeFileSync(join(dataDir, 'latest.json'), `${JSON.stringify(latest)}\n`);

  const failed = results.filter((result) => result.health.lastError);
  for (const result of failed) console.warn(`source failed: ${result.health.name}: ${result.health.lastError}`);
  const changed = shouldPublish(before !== canonical(state.threads), previousUpdatedAt, now);
  console.log(JSON.stringify({ sources: results.length, failed: failed.length, entries: results.reduce((n, r) => n + r.entries.length, 0), threads: threads.length, onBoard: latest.threads.length, changed }));
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: 'a' });
  if (failed.length === results.length && results.length > 0) {
    console.error('every source failed');
    process.exitCode = 1;
  }
}

await main();
