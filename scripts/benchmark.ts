// Private benchmark against MLBTR's feed, run on your own machine. Never publish its output.
// Run once per interval during the 7-day test, after `HOTSTOVE_INCLUDE_UNREVIEWED=1 npm run ingest`:
//   npm run benchmark            record the current snapshot
//   npm run benchmark -- report  print the results
// Stores only titles, links and times of MLBTR posts, in private/benchmark.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseFeed } from '@rowanmanning/feed-parser';
import { buildPlayerIndex, extract, findTeams, type PlayerEntry } from '../src/core/extract';
import { stateSchema } from '../src/core/schemas';
import { normalizeText } from '../src/core/text';
import { loadAliases } from '../src/pipeline/config';

const PATH = 'private/benchmark.json';
const dataDir = process.env.DATA_DIR ?? '.data';

interface Row { title: string; url: string; publishedAt: string; kind: string; playerId: number | null; subjectKey: string | null; caughtAt: string | null }

const players = JSON.parse(readFileSync(`${dataDir}/players.json`, 'utf8')) as PlayerEntry[];
const index = buildPlayerIndex(players, loadAliases());
const store: Record<string, Row> = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : {};

function kindOf(title: string, type: string | null): string {
  const normalized = normalizeText(title);
  if (/\b(signs?|agree|acquire|trade|claim|extension|re sign)\b/.test(normalized) && type === 'player') return 'move';
  return type ?? 'other';
}

async function record(): Promise<void> {
  const response = await fetch('https://www.mlbtraderumors.com/feed', { headers: { 'user-agent': 'hotstove-bot/0.1 (+https://github.com/howlcipher/hotstove)' } });
  const state = stateSchema.parse(JSON.parse(readFileSync(`${dataDir}/state.json`, 'utf8')));
  for (const item of parseFeed(await response.text()).items) {
    if (!item.url || !item.title || store[item.url]) continue;
    const found = extract(item.title, index);
    store[item.url] = { title: item.title, url: item.url, publishedAt: (item.published ?? new Date()).toISOString(), kind: kindOf(item.title, found.type), playerId: found.players[0]?.mlbamId ?? null, subjectKey: found.subjectKey, caughtAt: null };
  }
  for (const row of Object.values(store)) {
    if (row.caughtAt) continue;
    const thread = row.playerId !== null ? state.threads[`player-${row.playerId}`] : null;
    const teams = findTeams(normalizeText(row.title));
    const windowStart = Date.parse(row.publishedAt) - 2 * 86_400_000;
    const related = thread
      ? thread.items
      : row.subjectKey && state.threads[row.subjectKey] && teams.length > 0
        ? state.threads[row.subjectKey].items
        : [];
    const hit = related.filter((item) => Date.parse(item.publishedAt) >= windowStart).sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))[0];
    if (hit) row.caughtAt = hit.firstSeenAt;
  }
  mkdirSync('private', { recursive: true });
  writeFileSync(PATH, `${JSON.stringify(store, null, 1)}\n`);
  console.log(`tracked ${Object.keys(store).length} stories`);
}

function report(): void {
  const rows = Object.values(store);
  const kinds = [...new Set(rows.map((row) => row.kind))];
  for (const kind of kinds) {
    const group = rows.filter((row) => row.kind === kind);
    const caught = group.filter((row) => row.caughtAt);
    const lags = caught.map((row) => (Date.parse(row.caughtAt as string) - Date.parse(row.publishedAt)) / 60_000).sort((a, b) => a - b);
    const median = lags.length ? lags[Math.floor(lags.length / 2)].toFixed(0) : 'n/a';
    console.log(`${kind}: ${caught.length}/${group.length} caught, median lag behind MLBTR ${median} min`);
  }
  console.log('Coverage matches a thread for the same subject around the same time, so review a sample by hand. False statuses need a separate hand review.');
}

if (process.argv[2] === 'report') report();
else await record();
