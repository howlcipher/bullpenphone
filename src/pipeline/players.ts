import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlayerEntry } from '../core/extract';

const BASE = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data';
const SHARDS = '0123456789abcdef'.split('');
const MAX_AGE_MS = 7 * 86_400_000;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      out.push(field);
      field = '';
    } else field += char;
  }
  out.push(field);
  return out;
}

/** Keeps people with an MLB id who played in the majors or pro ball recently. */
export function parseRegister(csv: string, currentYear: number): PlayerEntry[] {
  const lines = csv.split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const at = (name: string) => header.indexOf(name);
  const [mlbam, first, last, mlbLast, proLast] = ['key_mlbam', 'name_first', 'name_last', 'mlb_played_last', 'pro_played_last'].map(at);
  const out: PlayerEntry[] = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const row = splitCsvLine(line);
    const id = Number(row[mlbam]);
    const name = `${row[first] ?? ''} ${row[last] ?? ''}`.trim();
    if (!id || !row[first] || !row[last]) continue;
    const recentMlb = Number(row[mlbLast] || 0) >= currentYear - 5;
    const recentPro = Number(row[proLast] || 0) >= currentYear - 2;
    if (recentMlb || recentPro) out.push({ mlbamId: id, name });
  }
  return out;
}

export async function loadPlayers(dataDir: string, now: Date): Promise<PlayerEntry[]> {
  const path = join(dataDir, 'players.json');
  // File times reset on checkout, so the fetch date is stored alongside the list.
  const metaPath = join(dataDir, 'players.meta.json');
  const fetchedAt = existsSync(metaPath) ? Date.parse((JSON.parse(readFileSync(metaPath, 'utf8')) as { fetchedAt?: string }).fetchedAt ?? '') : Number.NaN;
  if (existsSync(path) && now.getTime() - fetchedAt < MAX_AGE_MS) {
    return JSON.parse(readFileSync(path, 'utf8')) as PlayerEntry[];
  }
  try {
    const players: PlayerEntry[] = [];
    for (const shard of SHARDS) {
      const response = await fetch(`${BASE}/people-${shard}.csv`, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`register shard ${shard}: HTTP ${response.status}`);
      players.push(...parseRegister(await response.text(), now.getUTCFullYear()));
    }
    players.sort((a, b) => a.mlbamId - b.mlbamId);
    writeFileSync(path, `${JSON.stringify(players)}\n`);
    writeFileSync(metaPath, `${JSON.stringify({ fetchedAt: now.toISOString(), source: 'Chadwick Baseball Bureau Register', license: 'ODC-By 1.0' })}\n`);
    return players;
  } catch (error) {
    if (existsSync(path)) {
      console.warn(`player register refresh failed, using cached copy: ${String(error)}`);
      return JSON.parse(readFileSync(path, 'utf8')) as PlayerEntry[];
    }
    throw error;
  }
}
