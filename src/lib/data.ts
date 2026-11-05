import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emptyState, stateSchema, type Latest, type SourceHealth, type Thread } from '../core/schemas';
import { loadFeeds, loadNotice, loadOverrides, loadReporters, publishableFeeds, publishableReporters } from '../pipeline/config';
import { applyOverrides, buildLatest } from '../pipeline/threads';

const dataDir = resolve(process.env.DATA_DIR ?? '.data');
const includeUnreviewed = process.env.BULLPENPHONE_INCLUDE_UNREVIEWED === '1';

function read() {
  const path = join(dataDir, 'state.json');
  if (!existsSync(path)) return emptyState(new Date().toISOString());
  return stateSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export const state = read();
export const threads: Thread[] = applyOverrides(Object.values(state.threads), loadOverrides());
export const latest: Latest = buildLatest(threads, state.updatedAt);
export const notice = loadNotice();
export const feeds = publishableFeeds(loadFeeds(), includeUnreviewed);
export const reporters = publishableReporters(loadReporters(), includeUnreviewed);
export const health = (id: string): SourceHealth | undefined => state.health[id];
export const threadMap = new Map(threads.map((thread) => [thread.id, thread]));
export const RAW_LATEST_URL = 'https://raw.githubusercontent.com/howlcipher/bullpenphone/data/latest.json';
