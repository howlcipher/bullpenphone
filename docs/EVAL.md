# Status label evaluation

The gate: at least 50 labeled examples and at least 98% precision. A wrong "signed" about a real person is the worst failure this site can make, so labels stay off until they pass.

## Result, 2026-11-05: both labels stay off

| Label | Sample | Predicted | Correct | Precision | Gate |
|---|---|---|---|---|---|
| Agreement reported | Trade-news headlines, unseen holdout of 1,017 | 195 | 191 | 97.9% | **Fail** |
| Agreement reported | Current titles from feeds this site would display, 209 | 1 | 1 | Too few to judge | **Fail** |
| Fell through | Unseen holdout of 1,017 | 1 | 1 | Too few to judge | **Fail** |

## How to read this

- **The headlines differ from what's displayed.** The holdout is almost entirely one outlet's tidy, formulaic style, used privately under the benchmark-only decision. An earlier tuning sample of the displayed feeds had only 3 predictions, 2 of them wrong before fixes. So performance on the real sources is **unproven**, and the holdout probably flatters it.
- **Review wasn't independent.** The rules' author reviewed the predictions, seeing each prediction while judging it.
- **Only precision was measured.** No recall figure exists, so missed deals are unknown.
- **Rules changed after measuring.** The four holdout errors were then fixed, so this holdout can't be reused. Re-measuring needs new headlines.

## To pass

1. Collect real headlines from the enabled sources during the benchmark, until each gated class has at least 50 predictions.
2. Label them in `private/labels.json`, ideally with a second person.
3. Run `npm run eval -- private/labels.json`.
4. Set the label to `true` in `config/gates.yaml` only on a pass.

Until then, a done deal displays as `Unclassified`, then `Official` once MLB's data confirms it. The Deals page stays empty, because it depends on the same label.
