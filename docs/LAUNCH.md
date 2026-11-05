# Launch checklist

The site isn't public yet. Every item needs a person, because each is a legal or identity judgment or an outward-facing step.

## 1. Review source terms

A source is enabled by setting `reviewed: true` in `config/sources.yaml` after reading its terms.

| Source | Finding so far | Needed |
|---|---|---|
| ESPN | RSS terms allow unedited, linked, credited display with no ads. Enabled. | Confirm |
| MLB.com | Terms page couldn't be retrieved automatically | Read and decide |
| The Athletic / NYT | Terms page couldn't be retrieved automatically | Read and decide |
| Yahoo Sports | Not reviewed | Read and decide |
| New York Post | Not reviewed | Read and decide |
| CBS Sports | Terms bar scraping and indexing a significant portion of content. **Excluded.** | Written permission, if wanted |

If most are rejected, the launch set is ESPN, verified Bluesky accounts and official data, which is noticeably thinner.

## 2. Confirm reporter identities

Accounts with `identity: pending` in `config/reporters.yaml` don't have a platform verification badge. Confirm each belongs to the named reporter, for example through a link from their employer or verified profile.

## 3. Run the private benchmark for 7 days

On your own machine, periodically:

```bash
HOTSTOVE_INCLUDE_UNREVIEWED=1 npm run ingest && npm run benchmark
```

Then run `npm run benchmark -- report` and hand-check a sample. Output goes to `private/`, which is gitignored. Never publish it.

## 4. Decide on status labels

See [EVAL.md](EVAL.md). Both gated labels are off, so reported deals show as `Unclassified` until MLB data confirms them.

## 5. Go live

1. Make the repository public.
2. Set **Settings > Pages > Source** to **GitHub Actions**.
3. Set the repository variable `HOTSTOVE_LIVE` to `true`.
4. Run the **Update** workflow manually, then confirm:
   - The live URL updates, with valid Atom feeds.
   - The `data` commit shows as **Verified**. The workflow log prints the signature. If it isn't, switch to a GitHub App token.
   - The browser loads `latest.json` from the `data` branch, which needs a public repo.
5. Check real scheduled delays in the Actions history over the following days.

## After launch

- If a work stoppage freezes moves, set a notice in `config/site.yaml`.
- Update `config/aliases.yaml` when a player with a shared name changes clubs.
