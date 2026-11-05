# Bullpen Phone

Who's getting the call? A free, non-commercial, automated tracker of MLB trades, free agents and front office moves. It runs entirely on GitHub Actions and GitHub Pages, with one thread per story, a visible status, and links to the original reporting. It isn't affiliated with MLB, its clubs, or any outlet it links to.

**Live at <https://howlcipher.github.io/bullpenphone/> as a soft launch.** See [docs/LAUNCH.md](docs/LAUNCH.md) for sources and launch steps, and [docs/EVAL.md](docs/EVAL.md) for measured accuracy.

## How it works

```text
Every ~10 min (GitHub Action)
  fetch reviewed feeds and Bluesky -> extract player, team, status -> merge threads
    -> commit to `data` branch if changed -> build static site -> publish to `gh-pages`

In the visitor's browser
  latest.json from the `data` branch, falling back to Pages
  MLB Stats API -> Official badges, free agent list (never stored)
  Bluesky public API -> newest reporter posts
```

## Stack

TypeScript throughout, because the matching rules must also run in the browser. Astro builds static pages, Preact powers small interactive islands, Pagefind provides serverless search, and Zod guards every data boundary. Tests use Vitest, Playwright and axe.

## Develop

Requires the Node version in `.nvmrc`.

```bash
npm ci
BULLPENPHONE_INCLUDE_UNREVIEWED=1 npm run ingest   # local data in .data/, includes unverified reporters
npm run build                                  # type check, build, search index, output guard
node scripts/serve.mjs dist 4321               # http://localhost:4321/bullpenphone/
npm test                                       # unit tests
npx playwright install chromium webkit
npm run test:e2e            # all browsers, including the iPhone profile (WebKit)
npm run test:e2e:chromium   # for machines that lack WebKit's system libraries
```

## Configuration

| File | Purpose |
|---|---|
| `config/sources.yaml` | News feeds. Only `reviewed: true` feeds reach a published build, and `excluded: true` feeds never run. |
| `config/reporters.yaml` | Bluesky accounts. Only `identity: verified` accounts reach a published build. |
| `config/gates.yaml` | Turns on status labels that have passed evaluation. |
| `config/aliases.yaml` | Team context for names shared by several players. |
| `config/overrides.yaml` | Manual corrections and takedowns. |
| `config/site.yaml` | Site-wide notice, for events such as a lockout. |

## Data rules

- Only headlines, sources, times and links are stored. Article text is scanned in memory and discarded.
- MLB Stats API data is requested by each visitor's browser and is never committed or redistributed. CI fails if it appears in stored data or built output.
- MLB's terms permit only individual, non-commercial, non-bulk use, and don't explicitly address a public site. This project carries no ads or sponsorships for that reason.

## Credits and license

Code is under the [MIT License](LICENSE), which doesn't cover third-party data. Player names come from the [Chadwick Baseball Bureau Register](https://github.com/chadwickbureau/register) (Open Data Commons Attribution License). Official data © MLB Advanced Media, L.P., subject to [MLB's terms](https://gdx.mlb.com/components/copyright.txt). Headlines belong to their publishers.
