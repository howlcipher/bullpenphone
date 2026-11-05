import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = '/hotstove/';
const transactions = {
  copyright: 'mock',
  transactions: [
    { id: 1, date: '2026-11-05', typeDesc: 'Signed as Free Agent', description: 'New York Yankees signed free agent Signed Example.', person: { id: 2 }, toTeam: { id: 147 } },
    { id: 2, date: '2026-11-05', typeDesc: 'Assigned', description: 'Winter league noise.', person: { id: 3 }, toTeam: { id: 9001 } },
  ],
};
const freeAgents = {
  freeAgents: [
    { player: { id: 3, fullName: 'Other Player' }, position: { abbreviation: 'RHP' }, originalTeam: { id: 119 }, dateDeclared: '2026-11-02' },
    { player: { id: 99, fullName: 'José Ramírez' }, position: { abbreviation: '3B' }, originalTeam: { id: 114 }, dateDeclared: '2026-11-02' },
  ],
};
const bluesky = {
  feed: [{ post: { uri: 'at://did/app.bsky.feed.post/abc1', record: { text: '<img src=x onerror="window.__xss=1"> Mets in talks with a reliever', createdAt: new Date().toISOString() } } }],
};

async function mockLive(page: Page): Promise<void> {
  await page.route('https://statsapi.mlb.com/**/transactions**', (route) => route.fulfill({ json: transactions, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://statsapi.mlb.com/**/freeAgents**', (route) => route.fulfill({ json: freeAgents, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://public.api.bsky.app/**', (route) => route.fulfill({ json: bluesky, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://raw.githubusercontent.com/**', (route) => route.fulfill({ status: 404 }));
}

async function blockLive(page: Page): Promise<void> {
  for (const host of ['https://statsapi.mlb.com/**', 'https://public.api.bsky.app/**', 'https://raw.githubusercontent.com/**']) {
    await page.route(host, (route) => route.abort());
  }
}

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy/i.test(message.text())) problems.push(`csp: ${message.text()}`);
  });
  return problems;
}

test('board renders threads, official badge and live posts', async ({ page }) => {
  const problems = collectProblems(page);
  await mockLive(page);
  await page.goto(BASE);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('rumor board');
  const signed = page.locator('[data-thread="player-2"]');
  await expect(signed.locator('.status-official')).toHaveText('Official');
  await expect(page.locator('[data-thread="player-3"] .status-interest')).toHaveText('Interest');
  await expect(page.getByRole('heading', { name: 'Newest from reporters' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('hostile text renders inert everywhere', async ({ page }) => {
  await mockLive(page);
  for (const path of ['', 't/player-1/', 'team/nym/']) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('main img[src="x"], aside img[src="x"]').count()).toBe(0);
  }
  await page.goto(`${BASE}t/player-1/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hostile <b>Player</b>');
});

test('works with live services blocked', async ({ page }) => {
  const problems = collectProblems(page);
  await blockLive(page);
  await page.goto(BASE);
  await expect(page.locator('[data-thread="player-2"] .status-agreement-reported')).toBeVisible();
  await expect(page.locator('.status-official')).toHaveCount(0);
  await expect(page.getByText('Official badges unavailable right now')).toBeVisible();
  await page.goto(`${BASE}free-agents/`);
  await expect(page.getByText("MLB's list isn't available right now")).toBeVisible();
  expect(problems).toEqual([]);
});

test('server-rendered board works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://localhost:4321${BASE}`);
  await expect(page.locator('[data-thread="player-2"]')).toBeVisible();
  await context.close();
});

test('following teams filters the board and persists', async ({ page }) => {
  await mockLive(page);
  await page.goto(BASE);
  await page.locator('details.follow summary').click();
  await page.getByRole('checkbox', { name: 'New York Yankees' }).check();
  await expect(page.locator('[data-thread="player-2"]')).toBeVisible();
  await expect(page.locator('[data-thread="player-3"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-thread="player-3"]')).toHaveCount(0);
  await expect(page.locator('details.follow summary')).toHaveText('Following 1 team');
});

test('filters by type and status', async ({ page }) => {
  await mockLive(page);
  await page.goto(BASE);
  await expect(page.locator('[data-thread="player-2"] .status-official')).toBeVisible();
  await page.getByLabel('Type').selectOption('staff');
  await expect(page.locator('[data-thread="staff-hou"]')).toBeVisible();
  await expect(page.locator('[data-thread="player-3"]')).toHaveCount(0);
  await page.getByLabel('Type').selectOption('all');
  await page.getByLabel('Status').selectOption('Official');
  await expect(page.locator('.card')).toHaveCount(1);
});

test('thread page shows the source timeline and first-seen wording', async ({ page }) => {
  await mockLive(page);
  await page.goto(`${BASE}t/player-2/`);
  await expect(page.locator('.timeline li')).toHaveCount(2);
  await expect(page.getByText('First seen here').first()).toBeVisible();
  await expect(page.getByText('per MLB')).toBeVisible();
});

test('free agents list loads live and links threads', async ({ page }) => {
  await mockLive(page);
  await page.goto(`${BASE}free-agents/`);
  await page.getByLabel('Find a player').fill('jose ramirez');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Find a player').fill('');
  await expect(page.getByRole('link', { name: 'View thread' })).toHaveAttribute('href', `${BASE}t/player-3/`);
});

test('search finds a thread under the content security policy', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto(`${BASE}search/`);
  await page.getByLabel('Player, team or topic').fill('Signed Example');
  await expect(page.getByRole('link', { name: 'Signed Example' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('feeds are valid XML, and team feeds only hold that team', async ({ request }) => {
  const all = await (await request.get(`${BASE}feeds/all.xml`)).text();
  expect(all).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  expect(all).toContain('&lt;img');
  expect(all).not.toContain('<img');
  const nyy = await (await request.get(`${BASE}feeds/nyy.xml`)).text();
  expect(nyy).toContain('Signed Example');
  expect(nyy).not.toContain('Other Player');
});

for (const colorScheme of ['light', 'dark'] as const) test(`fits the screen and has no accessibility violations (${colorScheme})`, async ({ page }) => {
  await page.emulateMedia({ colorScheme });
  await mockLive(page);
  for (const path of ['', 'teams/', 'team/nyy/', 't/player-2/', 'deals/', 'free-agents/', 'search/', 'about/']) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows`).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${path}: ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
