# Launch checklist

The launch is a soft launch with no promotion. The 7-day comparison runs during the first week rather than before launch.

## 1. Source terms

Reviewed on 2026-11-05. This is a plain reading of each source's terms, not legal advice. Sources are set in `config/sources.yaml`.

| Source | Finding | Status |
|---|---|---|
| SB Nation (28 team sites) | Part of Penske Media, whose terms allow headline feeds in aggregators when unedited, directly linked and attributed. Penske may require us to stop. Headlines only, labeled as fan sites, and they never change a status. | **On** |
| Fish On First (Marlins) | Offers a public feed, but its posted terms don't address feed use. Headlines only, and removable on request. | **On, less certain** |
| Yahoo Sports | RSS terms allow display that is unmodified, attributed and linked, with no ads. Yahoo may require us to stop. | **On** |
| ESPN | RSS terms allow this display, but the feed failed from GitHub's servers and returns an empty `202` to some clients. | Off, not worked around |
| NYT / The Athletic | Bars automated collection and caching without written consent. | Excluded |
| MLB.com | Requires written permission to display content. | Excluded |
| New York Post | Limits use to personal, non-commercial, with no RSS allowance. | Excluded |
| CBS Sports | Bars scraping and indexing a significant portion of content. | Excluded |

Excluded sources must not run anywhere, including locally. Enable one only with written permission.

## 2. Reporter identities

`config/reporters.yaml` records how each account was checked. `verified` accounts have a platform badge. `corroborated` accounts have a matching bio and at least two verified reporters on the list following them, which is strong evidence rather than proof. `pending` accounts stay out of published builds. Bob Nightengale is pending because only one verified reporter follows the account. A test requires every club to have at least one team-specific source.

## 3. Run the private benchmark for 7 days

This covers enabled and pending sources only. On your own machine, periodically:

```bash
BULLPENPHONE_INCLUDE_UNREVIEWED=1 npm run ingest && npm run benchmark
```

Then run `npm run benchmark -- report` and hand-check a sample. Output goes to `private/`, which is gitignored. Never publish it.

## 4. Decide on status labels

See [EVAL.md](EVAL.md). Both gated labels are off, so reported deals show as `Unclassified` until MLB data confirms them.

## 5. Go live

1. Make the repository public.
2. Set **Settings > Pages** to deploy from the `gh-pages` branch, root folder, after its first publish.
3. Set the repository variable `BULLPENPHONE_LIVE` to `true`.
4. Run the **Update** workflow manually, then confirm:
   - The live URL updates, with valid Atom feeds.
   - The `data` commit shows as **Verified**. The workflow log prints the signature.
   - The browser loads `latest.json` from the `data` branch, which needs a public repo.
5. Open the live site on a real iPhone and a real Android phone, including **Add to Home Screen**.
6. Check real scheduled delays in the Actions history over the following days.

## After launch

- If a work stoppage freezes moves, set a notice in `config/site.yaml`.
- Update `config/aliases.yaml` when a player with a shared name changes clubs.

## Constraints

Nothing here may cost money or break a site's terms. No paid APIs, scraping or bot-protection workarounds.

## Open items

- **Refresh rate:** every 10 minutes. GitHub's minimum is 5, but branch-based Pages has a soft limit of 10 builds an hour, and visitors see cached data for several minutes anyway. Don't go faster than 10.
- **Workflow cleanup:** the publish job's `pages: write` permission is no longer needed. Remove it once schedules are confirmed, to avoid disturbing them sooner.
- **Scheduled runs:** none had fired as of 2026-11-05. Other new public repos report the same since 2026-11-02, with first runs hours late. The free fallback is a scheduling service calling the `workflow_dispatch` API with a fine-grained token.
- **Bluesky developer guidelines:** couldn't be loaded for review. The Terms of Service showed no conflict.
- **MLB Stats API:** each visitor's browser makes small, non-commercial requests, but MLB's terms don't explicitly address a public site.
