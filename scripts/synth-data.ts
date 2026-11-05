// Writes a synthetic state file for the build-time gate. Usage: synth <threads> <dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyState, stateSchema, STATUSES, type Thread } from '../src/core/schemas';
import { TEAMS } from '../src/core/teams';

const count = Number(process.argv[2] ?? 5000);
const dir = process.argv[3] ?? '.data-synth';
const now = new Date().toISOString();
const state = emptyState(now);
for (let i = 0; i < count; i += 1) {
  const items: Thread['items'] = Array.from({ length: 6 }, (_, n) => ({
    id: `synth${i}x${n}`,
    title: `Synthetic report ${n} about player number ${i} and a possible move this offseason`,
    url: `https://example.com/${i}/${n}`,
    sourceId: 'synth',
    sourceName: 'Synthetic',
    sourceKind: 'news' as const,
    publishedAt: now,
    firstSeenAt: now,
    role: 'primary' as const,
    status: STATUSES[n % STATUSES.length],
    teams: [TEAMS[i % 30].abbr],
  }));
  state.threads[`player-${i}`] = { id: `player-${i}`, type: 'player', subject: `Synthetic Player ${i}`, mlbamId: i, teams: [TEAMS[i % 30].abbr], status: 'Talks', statusAt: now, firstSeenAt: now, lastActivityAt: now, items };
}
stateSchema.parse(state);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
console.log(`wrote ${count} threads to ${dir}`);
