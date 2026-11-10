# rloop-quality: research quality fixes after the first live run

Status: approved 2026-11-11. Loop `rloop-quality`, branch `feat/rloop-quality`, stacked on
`feat/research-loop` (PR csakash/open-research#1).

## Context

The first live run ("sleep and procedural memory in older adults", 100 papers, PR #2) showed
three quality problems:
1. Count-share allocation gave 95/100 papers to the broad OpenAlex query, while the targeted
   PubMed (124 hits) and Europe PMC (69) queries got 3 and 1.
2. The disprover ran exactly the 10-search minimum on every gap.
3. Partly answered gaps got only a "weakens" caveat. For example, g01's SO-spindle coupling
   half is already answered by a 32-person older-adult study. No resolve round ran, so the
   report kept the over-broad question.

## Decisions (user, 2026-11-11)

- D1: split papers by square-root weighting with a 10% floor per database. The gate shows the split.
- D2: the search bar adapts. 10 searches per surviving gap, or 15 when the disprover raised a
  finding on that gap. At least 3 databases.
- D3: the author must narrow or rebut a partly answered gap, and the disprover re-checks the narrowed gap.

## Changes

### 1. Allocation (`lib/stages/map.js` `allocate`, `lib/stages/scope.js` gate)

- Usable sources are those that can be searched and have count > 0. If n < number of usable
  sources, keep today's rule: 1 paper each from the n largest.
- Otherwise each source gets a floor of `min(count, max(1, floor(0.10 * n)))`. The remainder
  is shared in proportion to `sqrt(count)`. A source never exceeds its count: water-filling
  reassigns any overflow to the rest. Rounding is largest-remainder, so the split sums to
  exactly `min(n, total available)`.
- Live-run counts check: n=100 with {openalex 3249, pubmed 124, europepmc 69,
  clinicaltrials 33} gives openalex 52, pubmed 18, europepmc 16, clinicaltrials 14 (sum 100).
- The gate prints `Planned split: …` once N is known. In interactive mode it asks
  `Fetch this split? [Y/n]` before writing `selection.json`, and `n` stops at the gate.
  `selection.json` records the planned split.

### 2. Adaptive search bar (`lib/citegate.js`, `prompts/disprove.md`, `loops.json`)

- Config `research.disprove`: `{ minQueries: 10, minSources: 3, extraQueriesIfFinding: 5 }`.
- A surviving gap with any disprover finding (any severity, any cycle) needs
  `minQueries + extraQueriesIfFinding` distinct signed searches. Otherwise it needs
  `minQueries`. Both need `minSources` distinct databases.
- The disprover prompt states the rule, so it knows to keep searching once it finds related work.
- `proof/search-coverage.json` records `required` per gap.

### 3. Narrow-or-rebut (`lib/stages/disprove.js`, `lib/contracts.js`, `prompts/*.md`, report)

- A `weakens` finding requires narrowing when its class is `mis-stated`, or when it cites at
  least one source and its class is `answered-by-prior-work` or `already-in-progress`. Such a
  finding enters the review store as blocking (`important`), with `narrow: true`.
- Resolution statuses: `dropped`, `rebutted`, and new `narrowed`. `narrowed` needs a reason
  AND a changed `question` for that gap in `gaps.json`, otherwise it is rejected with
  "narrowed but question unchanged". It is allowed for kill findings too.
- Narrowed and rebutted gaps (with their edits) go back to the disprover. The original
  question is kept as `narrowedFrom`.
- At the cap: open kill findings block, as today. Open narrow-only findings do not block. The
  gap survives with `narrowing: "incomplete"`, shown in the report.
- REPORT.md shows "Narrowed from: …" with the finding that triggered it.

## Acceptance criteria

1. `allocate(100, live-run counts)` returns 52/18/16/14. Every source ≥ floor; sum = n; no
   source above its count; n < sources keeps the 1-each rule.
2. With `--papers N`, the gate prints the planned split, and `selection.json` contains it.
3. A gap with a finding and 12 queries blocks at citegate ("needs 15"). The same gap with 15
   queries across 3 sources passes. A gap with no finding passes with 10.
4. Runner scenario `narrow`: the disprover raises `weakens`/`mis-stated` on g01, the author
   narrows it, and the cycle-2 disprover is clean. g01 survives with the new question and
   `narrowedFrom`. REPORT.md shows both.
5. A `narrowed` resolution with an unchanged question is rejected, and the finding stays open.
   At the cap a narrow-only finding does not block (`narrowing: "incomplete"`), but a kill does.
6. `npm test` and `npm run build` are green. `scripts/probe-sandbox.js` passes 13/13 on the real CLI.
7. Live re-run on the same topic, `--papers 100`: no source above 60% of the papers, and at
   least one gap narrowed or reported as incomplete narrowing.

## Out of scope

- Changing the sandbox or agent permissions. Semantic Scholar rate limits. Ranking formula.
