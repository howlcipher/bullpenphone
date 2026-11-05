import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = '/bullpenphone/';
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
    await page.route(host, (route) => route.fulfill({ status: 503, body: 'unavailable', headers: { 'access-control-allow-origin': '*' } }));
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

// WebKit's own <select> uses an internal inline style that any strict policy refuses. A
// bare test page with only a <select> and no site code reproduced it, once per control.
// So WebKit must report exactly one refusal per select: any other refusal still fails.
function expectClean(problems: string[], browserName: string, selectsVisited: number): void {
  const refusal = /^csp: Refused to apply a stylesheet/;
  const others = problems.filter((problem) => !refusal.test(problem));
  expect(others).toEqual([]);
  expect(problems.filter((problem) => refusal.test(problem)).length).toBe(browserName === 'webkit' ? selectsVisited : 0);
}

test('board renders threads, official badge and live posts', async ({ page, browserName }) => {
  const problems = collectProblems(page);
  await mockLive(page);
  await page.goto(BASE);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('getting the call');
  const signed = page.locator('[data-thread="player-2"]');
  await expect(signed.locator('.status-official')).toHaveText('Official');
  await expect(page.locator('[data-thread="player-3"] .status-interest')).toHaveText('Interest');
  await expect(page.getByText('From the bullpen')).toBeVisible();
  await expect(page.locator('.live').first().locator('.count')).toHaveText(/\d+ new/);
  expectClean(problems, browserName, 2);
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

test('works with live services blocked', async ({ page, browserName }) => {
  const problems = collectProblems(page);
  await blockLive(page);
  await page.goto(BASE);
  await expect(page.locator('[data-thread="player-2"] .status-agreement-reported')).toBeVisible();
  await expect(page.locator('.status-official')).toHaveCount(0);
  await expect(page.getByText('Official badges unavailable right now')).toBeVisible();
  await page.goto(`${BASE}free-agents/`);
  await expect(page.getByText("MLB's list isn't available right now")).toBeVisible();
  expectClean(problems, browserName, 2);
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
  await expect(async () => {
    await page.locator('.follow-toggle').click();
    await expect(page.getByRole('checkbox', { name: 'New York Yankees' })).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.getByRole('checkbox', { name: 'New York Yankees' }).check();
  await expect(page.locator('[data-thread="player-2"]')).toBeVisible();
  await expect(page.locator('[data-thread="player-3"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-thread="player-3"]')).toHaveCount(0);
  await expect(page.locator('.follow-toggle')).toHaveText('Following 1 team');
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
    expect(results.violations.map((v) => `${path}: ${v.id}: ${v.nodes[0]?.target}: ${v.nodes[0]?.failureSummary}`)).toEqual([]);
  }
});

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1280) < 900;

test('reporter panel sits above the board and collapses on phones, and opens beside it on desktop', async ({ page }) => {
  await mockLive(page);
  await page.goto(BASE);
  const panel = page.locator('.live').first();
  const toggle = panel.locator('.live-toggle');
  await expect(panel.locator('.count')).toHaveText(/\d+ new/);
  const phone = isPhone(page);
  await expect(toggle).toHaveAttribute('aria-expanded', String(!phone));
  const panelBox = await panel.boundingBox();
  const boardBox = await page.locator('.controls').boundingBox();
  if (phone) {
    expect(panelBox!.y).toBeLessThan(boardBox!.y);
    await toggle.click();
    await expect(panel.getByRole('link', { name: /Mets in talks/ }).first()).toBeVisible();
  } else {
    expect(panelBox!.x).toBeGreaterThan(boardBox!.x + boardBox!.width - 1);
  }
});

test('long boards page with show more, and filters reset paging', async ({ page }) => {
  const many = Array.from({ length: 95 }, (_, n) => ({
    id: `player-${1000 + n}`, type: 'player', subject: `Many Player ${n}`, mlbamId: 1000 + n, teams: ['NYM'], status: 'Interest',
    firstSeenAt: '2026-12-01T00:00:00.000Z', lastActivityAt: '2026-12-01T00:00:00.000Z', itemCount: 1, sourceCount: 1,
    top: { title: `Report ${n}`, url: `https://example.com/m${n}`, sourceName: 'ESPN', at: '2026-12-01T00:00:00.000Z' },
  }));
  await mockLive(page);
  await page.unroute('https://raw.githubusercontent.com/**');
  await page.route('https://raw.githubusercontent.com/**', (route) => route.fulfill({ json: { version: 1, generatedAt: '2030-01-01T00:00:00.000Z', threads: many }, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(BASE);
  await expect(page.locator('.card')).toHaveCount(40);
  await expect(page.getByText('Showing 40 of 95 threads')).toBeVisible();
  await page.getByRole('button', { name: 'Show 40 more' }).click();
  await expect(page.locator('.card')).toHaveCount(80);
  await page.getByRole('button', { name: 'Show 15 more' }).click();
  await expect(page.locator('.card')).toHaveCount(95);
  await expect(page.locator('.show-more')).toHaveCount(0);
  await page.getByLabel('Status').selectOption('Talks');
  await page.getByLabel('Status').selectOption('all');
  await expect(page.locator('.card')).toHaveCount(40);
});

test('tables fit a phone with every field reachable', async ({ page }) => {
  await mockLive(page);
  await page.goto(`${BASE}free-agents/`);
  const link = page.getByRole('link', { name: 'View thread' });
  await expect(link).toBeVisible();
  await page.goto(`${BASE}deals/`);
  await expect(page.getByRole('link', { name: 'ESPN' })).toBeVisible();
  for (const path of ['free-agents/', 'deals/']) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle');
    const overflow = await page.locator('.table-wrap').evaluate((el) => el.scrollWidth - el.clientWidth);
    if (isPhone(page) && (page.viewportSize()?.width ?? 0) < 640) expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto(`${BASE}free-agents/`);
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await expect(page.locator('tbody tr').filter({ hasText: 'José Ramírez' }).locator('td[data-label="Signed with"]')).toBeHidden();
    await expect(page.locator('tbody tr').filter({ hasText: 'José Ramírez' }).locator('td[data-label="Rumors"]')).toBeHidden();
  }
  await page.getByLabel('Sort by').selectOption('from');
  await expect(page.locator('tbody tr').first()).toContainText('José Ramírez');
});

test('touch targets are large enough on phones', async ({ page }) => {
  test.skip(!isPhone(page), 'phone layout only');
  await mockLive(page);
  const rules: Array<[string, number]> = [
    ['.masthead nav a', 44], ['.controls select', 44], ['.follow-toggle', 44], ['.live-toggle', 44],
    ['.team-chip', 32], ['.subject', 32], ['.headline', 32],
  ];
  await page.goto(BASE);
  // Retry until the island has hydrated and the panel opens. A click before then does nothing.
  await expect(async () => {
    await page.locator('.follow-toggle').click();
    await expect(page.locator('.follow-grid label').first()).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.waitForLoadState('networkidle');
  for (const [selector, minimum] of [...rules, ['.follow-grid label', 44] as [string, number]]) {
    const heights = await page.locator(selector).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height).filter((h) => h > 0));
    expect(heights.length, selector).toBeGreaterThan(0);
    expect(Math.min(...heights), selector).toBeGreaterThanOrEqual(minimum);
  }
});

test('home screen icons and manifest are available', async ({ request }) => {
  const manifest = await (await request.get(`${BASE}manifest.webmanifest`)).json();
  expect(manifest.name).toBe('Bullpen Phone');
  for (const file of ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']) {
    expect((await request.get(`${BASE}${file}`)).ok(), file).toBe(true);
  }
});

test('review screenshots', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockLive(page);
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: info.outputPath(`home-${info.project.name}.png`) });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath(`home-dark-${info.project.name}.png`) });
  const color = await page.locator('h1').evaluate((el) => `${getComputedStyle(el).color} on ${getComputedStyle(document.body).backgroundColor}`);
  console.log(`${info.project.name} dark h1: ${color}`);
  const styled = await page.locator('.masthead').evaluate((el) => getComputedStyle(el).borderBottomStyle);
  expect(styled, 'site stylesheet applied').toBe('double');
});

test('official moves panel shows MLB club moves and hides winter league noise', async ({ page }) => {
  await mockLive(page);
  await page.goto(BASE);
  const toggle = page.locator('#moves-toggle');
  await expect(toggle).toBeVisible();
  if (isPhone(page)) await toggle.click();
  await expect(page.locator('#moves-body')).toContainText('Signed Example');
  await expect(page.locator('#moves-body')).not.toContainText('Winter league noise');
});

test('home page makes one MLB request for all panels', async ({ page }) => {
  await mockLive(page);
  let calls = 0;
  page.on('request', (request) => { if (request.url().includes('/transactions')) calls += 1; });
  await page.goto(BASE);
  await expect(page.locator('#moves-toggle')).toBeVisible();
  expect(calls).toBe(1);
});

test('thread pages request one player, not the whole league', async ({ page }) => {
  await mockLive(page);
  const urls: string[] = [];
  page.on('request', (request) => { if (request.url().includes('statsapi.mlb.com')) urls.push(request.url()); });
  await page.goto(`${BASE}t/player-2/`);
  await expect(page.getByText('per MLB')).toBeVisible();
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(url).toContain('playerId=2');
});

test('shared links get a title, description and a real image', async ({ page, request }) => {
  const live = 'https://howlcipher.github.io/bullpenphone/';
  await page.goto(`${BASE}t/player-2/`);
  const tag = (name: string) => page.locator(`meta[property="${name}"]`).getAttribute('content');
  expect(await tag('og:title')).toContain('Signed Example');
  expect(await tag('og:url')).toBe(`${live}t/player-2/`);
  expect(await tag('og:description')).toBeTruthy();
  const image = await tag('og:image');
  expect(image).toBe(`${live}og-image.png`);
  const png = await request.get(`${BASE}og-image.png`);
  expect(png.ok()).toBe(true);
  const bytes = await png.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  await page.goto(BASE);
  expect(await tag('og:title')).toContain('getting the call');
});
