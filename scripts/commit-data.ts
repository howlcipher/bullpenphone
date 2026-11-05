// Commits changed data files to the `data` branch through GitHub's GraphQL API.
// It never force-pushes. A concurrent update fails the run and the next run retries.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['state.json', 'latest.json', 'players.json', 'players.meta.json'];
const dataDir = process.env.DATA_DIR ?? '.data';
const repo = process.env.GITHUB_REPOSITORY as string;
const token = process.env.GITHUB_TOKEN as string;
if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', ...init?.headers } });
}

async function branchHead(): Promise<string> {
  const existing = await api(`/repos/${repo}/git/ref/heads/data`);
  if (existing.ok) return ((await existing.json()) as { object: { sha: string } }).object.sha;
  const main = (await (await api(`/repos/${repo}/git/ref/heads/main`)).json()) as { object: { sha: string } };
  const created = await api(`/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/data', sha: main.object.sha }) });
  if (!created.ok) throw new Error(`could not create data branch: ${created.status}`);
  return main.object.sha;
}

const head = await branchHead();
const remote = (file: string): Buffer | null => {
  try {
    return execFileSync('git', ['show', `origin/data:${file}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64_000_000 });
  } catch {
    return null;
  }
};
const additions = FILES.filter((file) => existsSync(join(dataDir, file)))
  .filter((file) => {
    const previous = remote(file);
    return previous === null || !previous.equals(readFileSync(join(dataDir, file)));
  })
  .map((file) => ({ path: file, contents: readFileSync(join(dataDir, file)).toString('base64') }));

if (additions.length === 0) {
  console.log('no data changes');
} else {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid signature { isValid state } } } }',
      variables: { input: { branch: { repositoryNameWithOwner: repo, branchName: 'data' }, expectedHeadOid: head, message: { headline: `data: update ${new Date().toISOString()}` }, fileChanges: { additions } } },
    }),
  });
  const body = (await response.json()) as { errors?: unknown; data?: { createCommitOnBranch?: { commit?: { oid: string; signature?: { isValid: boolean; state: string } | null } } } };
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  const commit = body.data?.createCommitOnBranch?.commit;
  console.log(`committed ${commit?.oid}, signature ${JSON.stringify(commit?.signature ?? null)}`);
  if (!commit?.signature?.isValid) console.warn('warning: commit is not verified. See docs/LAUNCH.md.');
}
