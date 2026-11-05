// Renders public/og-image.png, the 1200x630 card shown when a link is shared.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}`;
const handset = 'M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15 15 0 0 1-6.59-6.59l2.2-2.21a1 1 0 0 0 .25-1.01A11.4 11.4 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1z';
const html = `<!doctype html><style>
@font-face { font-family: Script; src: url(${font('yellowtail', 'yellowtail-latin-400-normal.woff2')}); }
@font-face { font-family: Display; font-weight: 700; src: url(${font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')}); }
@font-face { font-family: Agate; font-weight: 700; src: url(${font('courier-prime', 'courier-prime-latin-700-normal.woff2')}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #14213d; position: relative;
  background-image: repeating-linear-gradient(90deg, transparent 0 39px, rgb(255 255 255 / .06) 39px 41px); color: #f4ecd8; }
.top { position: absolute; left: 72px; right: 72px; top: 62px; display: flex; align-items: center; gap: 22px; }
.top svg { width: 76px; height: 76px; flex: none; }
.brand { font: 400 150px/1.15 Script; transform: rotate(-3deg); transform-origin: left center; text-shadow: 7px 7px 0 #c8102e; white-space: nowrap; }
.band { position: absolute; left: 0; right: 0; top: 322px; height: 26px; background: linear-gradient(#c8102e 0 9px, #f4ecd8 9px 17px, #c8102e 17px 26px); }
.call { position: absolute; left: 72px; top: 378px; font: 700 104px/1 Display; text-transform: uppercase; letter-spacing: .005em; color: #e0a526; white-space: nowrap; }
.topics { position: absolute; left: 74px; bottom: 54px; font: 700 34px/1 Agate; text-transform: uppercase; letter-spacing: .06em; }
</style>
<div class="top"><svg viewBox="0 0 24 24"><path fill="#f4ecd8" d="${handset}"/></svg><div class="brand">Bullpen Phone</div></div>
<div class="band"></div>
<div class="call">Who's getting the call?</div>
<div class="topics">Trades / Free agents / Front office</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
