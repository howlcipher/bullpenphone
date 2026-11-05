# Roadmap

Suggestions, roughly in priority order. Nothing here is committed work. Every item must stay free and within each source's terms.

## Now

1. **Confirm automatic updates.** Scheduled runs hadn't started as of 2026-11-05. Nothing below matters much until the site refreshes itself. If they still don't start, contact GitHub Support, then consider a free outside scheduler after reading its terms.
2. **Check it on real phones.** Test an iPhone and an Android phone, including Add to Home Screen and shared link previews.
3. **Read Bluesky's developer guidelines.** They couldn't be loaded on 2026-11-05, and the API and feeds now rely on Bluesky alone. Also check whether Bluesky's proposed user preferences for AI reuse were adopted, and honor them.
4. **Run the 7-day MLBTR comparison.** It's the only real measure of coverage. It needs a free schedule of its own or occasional manual runs, and its results must stay private.

## Better stories

5. **Measure a two-reporter rule for "Agreement reported".** The label failed its gate at about 90% (see `docs/EVAL.md`). Requiring two independent reporters may reach 98%, at the cost of some delay. It stays off until measured.
6. **Tune the board ranking.** It now weighs reporters, independent sources, status and age. Review it over a real week of news and adjust.
7. **Build on topic threads and last names.** Both are new and conservative. Check for misfiled stories, and extend them only where reporting supports it.
8. **Use beat writers' clubs as context.** `config/reporters.yaml` records them, but extraction doesn't use them yet. This would need care so a passing mention doesn't tag a writer's club.

## More reach, at no cost

11. **Post new stories from a Bluesky account.** Free, and it brings the site to where reporters and fans already are. Needs an account and strict quality limits, so it comes after item 5.
12. **Seek permission from sources.** A short request to The Athletic, MLB.com or Penske could open better coverage. They'd stay off unless the answer is a written yes.
13. **Add official moves to team pages.** The home page panel could filter by club, using MLB's data under the same small, browser-only requests.

## Reliability

14. **Alert on a failing source.** A source that fails for days is only visible on the About page. Open a GitHub issue automatically after repeated failures.
15. **Plan for growing data.** `state.json` and page count grow all season. Archive quiet threads after a set period and keep `data` branch commits modest.
16. **Remove the unused `pages: write` permission** from the publish job once schedules are confirmed.
17. **Review the remaining gray areas.** Those are public-site use of MLB data, Fish On First's silent terms, and headlines in the public `data` branch and `/data/latest.json`, which the site itself reads.

## Deliberately not planned

- **X, or any paid API:** not free, and its terms ban scraping.
- **Scraping, or working around bot protection:** would break site terms.
- **Ads, sponsorships or subscriptions:** MLB's terms and GitHub Pages rule these out here.
- **Custom domain:** costs money, and the GitHub address works.
