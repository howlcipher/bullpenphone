// Publishes dist/ to the gh-pages branch as one verified commit through GitHub's API.
// Only changed files are sent. It never force-pushes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gitBlobSha, planPublish } from '../src/pipeline/publish-plan';

const BRANCH = 'gh-pages';
const siteDir = process.argv[2] ?? 'dist';
const repo = process.env.GITHUB_REPOSITORY as string;
const token = process.env.GITHUB_TOKEN as string;
if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', ...init?.headers } });
}

async function branchHead(): Promise<string> {
  const existing = await api(`/repos/${repo}/git/ref/heads/${BRANCH}`);
  if (existing.ok) return ((await existing.json()) as { object: { sha: string } }).object.sha;
  // A new branch starts from main. The first publish removes everything that isn't the site.
  const main = (await (await api(`/repos/${repo}/git/ref/heads/main`)).json()) as { object: { sha: string } };
  const created = await api(`/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: main.object.sha }) });
  if (!created.ok) throw new Error(`could not create ${BRANCH}: ${created.status}`);
  return main.object.sha;
}

function localFiles(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) localFiles(full, out);
    else out.set(relative(siteDir, full).split(sep).join('/'), gitBlobSha(readFileSync(full)));
  }
  return out;
}

const head = await branchHead();
const treeResponse = await api(`/repos/${repo}/git/trees/${head}?recursive=1`);
if (!treeResponse.ok) throw new Error(`could not read ${BRANCH}: ${treeResponse.status}`);
const tree = (await treeResponse.json()) as { truncated: boolean; tree: Array<{ path: string; type: string; sha: string }> };
if (tree.truncated) throw new Error('branch tree too large to compare');
const remote = new Map(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.sha]));
const local = localFiles(siteDir);
if (!local.has('index.html') || !local.has('.nojekyll')) throw new Error('refusing to publish: index.html or .nojekyll is missing');
const plan = planPublish(local, remote);

if (plan.add.length === 0 && plan.remove.length === 0) {
  console.log('site unchanged');
} else {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid signature { isValid state } } } }',
      variables: {
        input: {
          branch: { repositoryNameWithOwner: repo, branchName: BRANCH },
          expectedHeadOid: head,
          message: { headline: `site: publish ${new Date().toISOString()}` },
          fileChanges: {
            additions: plan.add.map((path) => ({ path, contents: readFileSync(join(siteDir, path)).toString('base64') })),
            deletions: plan.remove.map((path) => ({ path })),
          },
        },
      },
    }),
  });
  const body = (await response.json()) as { errors?: unknown; data?: { createCommitOnBranch?: { commit?: { oid: string; signature?: { isValid: boolean } | null } } } };
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  const commit = body.data?.createCommitOnBranch?.commit;
  console.log(`published ${commit?.oid}: ${plan.add.length} changed, ${plan.remove.length} removed, signature ${JSON.stringify(commit?.signature ?? null)}`);
  // Commits made with the workflow token may not start a Pages build, so ask for one.
  const build = await api(`/repos/${repo}/pages/builds`, { method: 'POST' });
  if (!build.ok) throw new Error(`published, but could not request a Pages build: ${build.status}`);
  console.log('requested Pages build');
}
