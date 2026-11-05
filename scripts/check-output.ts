// Fails if the built site or stored data contains things that must never be published.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const FORBIDDEN: Array<[RegExp, string]> = [
  [/MLB Advanced Media, L\.P\.\s+Use of any content/, 'an MLB API response'],
  [/"(freeAgents|transactions)"\s*:\s*\[\s*\{/, 'stored MLB API data'],
  [/"scanText"/, 'article text field'],
  [/SECRET ARTICLE BODY/, 'article body sentinel'],
];
const TEXT = new Set(['.html', '.json', '.xml', '.js', '.txt']);

export const missingPaths = (paths: string[]): string[] => paths.filter((path) => !existsSync(path));

export function scan(dir: string): string[] {
  const problems: string[] = [];
  const walk = (path: string): void => {
    for (const name of readdirSync(path)) {
      if (name === 'pagefind' || name === 'players.json') continue;
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT.has(extname(name))) {
        const body = readFileSync(full, 'utf8');
        for (const [pattern, label] of FORBIDDEN) if (pattern.test(body)) problems.push(`${full}: ${label}`);
      }
    }
  };
  walk(dir);
  return problems;
}

if (process.argv[1]?.endsWith('check-output.ts')) {
  const paths = process.argv.slice(2);
  // A guard with nothing to inspect must fail, not pass.
  const missing = missingPaths(paths);
  if (paths.length === 0 || missing.length > 0) {
    console.error(`nothing to check, missing: ${missing.join(', ') || 'no paths given'}`);
    process.exit(1);
  }
  const problems = paths.flatMap(scan);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('output check passed');
}
