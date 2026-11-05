// Temporary: finds what WebKit's style refusals come from. Removed once answered.
import { test } from '@playwright/test';

const CSP = "default-src 'self'; style-src 'self'";
const CASES: Record<string, string> = {
  empty: '<p>x</p>',
  select: '<select><option>a</option></select>',
  button: '<button>a</button>',
  search: '<input type="search">',
  checkbox: '<input type="checkbox">',
  details: '<details><summary>a</summary>b</details>',
};

for (const [name, html] of Object.entries(CASES)) {
  test(`csp case ${name}`, async ({ page }, info) => {
    const lines: string[] = [];
    page.on('console', (m) => { if (/content security policy/i.test(m.text())) lines.push(m.text().slice(0, 60)); });
    await page.route('http://diag.test/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta http-equiv="content-security-policy" content="${CSP}"><body>${html}` }));
    await page.goto('http://diag.test/');
    await page.waitForTimeout(400);
    console.log(`DIAG ${info.project.name} ${name}: ${lines.length} refusals`);
  });
}

test('csp violations on the real home page', async ({ page }, info) => {
  await page.addInitScript(() => {
    (window as unknown as { __v: string[] }).__v = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __v: string[] }).__v.push(`${e.effectiveDirective}|${e.blockedURI}|${e.sourceFile}:${e.lineNumber}|${e.sample}`);
    });
  });
  await page.goto('/bullpenphone/');
  await page.waitForTimeout(1500);
  const violations = await page.evaluate(() => (window as unknown as { __v: string[] }).__v);
  const sheets = await page.evaluate(() => [...document.styleSheets].map((s) => `${s.href ?? 'inline'}:${s.cssRules.length}`));
  console.log(`DIAG ${info.project.name} home violations: ${JSON.stringify(violations)}`);
  console.log(`DIAG ${info.project.name} home sheets: ${JSON.stringify(sheets)}`);
  await page.emulateMedia({ colorScheme: 'dark' });
  const bg = await page.evaluate(() => ({ html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor }));
  console.log(`DIAG ${info.project.name} dark backgrounds: ${JSON.stringify(bg)}`);
});
