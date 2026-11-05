# Change log

## Unreleased

- Sources: launch with Yahoo and verified Bluesky reporters. ESPN is off, and NYT/The Athletic, MLB.com, NY Post and CBS are excluded from every run after a terms review.
- An empty `202` from a source now reports as blocked instead of a parse error.
- Replaced `<details>` with accessible buttons after WebKit reported Content Security Policy refusals on pages using it.
- CI keeps Playwright screenshots and traces.

- Renamed the project to Bullpen Phone, because "Hot Stove" is also an MLB Network show.
- Phones: a collapsible reporter panel above the board, larger touch targets, card layouts for tables, "show more" paging, and iOS home screen icons.
- Tests: added small-phone and iPhone (WebKit) profiles, plus touch target checks.

- Initial pipeline: reviewed feeds and verified Bluesky accounts, rule-based extraction, threads, and a `data` branch.
- Static site: board, team pages, threads, reported deals, free agents, search, about, and Atom feeds.
- Browser layer: Official badges and the free agent list from MLB, and newest reporter posts from Bluesky.
- Guardrails: source review gate, label gates, output checks, strict data schemas, and a Content Security Policy.
- Workflows: CI, build gate, scheduled update, and health check. Scheduled work stays off until launch.
