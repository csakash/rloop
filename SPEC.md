# rloop v1: research-gap discovery on gstack-loops

Status: draft for review (2026-11-11). Loop: `research-loop`, branch `feat/research-loop`.

## Context

Akash (solo) wants to point an agent at any research topic and get back a short list of
specific, evidence-backed research gaps: questions where the published evidence is missing,
weak or contradictory, and where an independent agent tried and failed to find prior work that
already answers them.

Asking a model "what hasn't been studied?" does not work: its sense of novelty stops at its
training data and it rarely checks. The fix is the same shape gstack-loops already uses for
code: an author does the work, a separate fresh-context reviewer attacks it, fixes converge
within a cap, a no-LLM gate checks the proof, and a human reviews the result as a PR.

## Current state (verified 2026-11-11)

- `open-research` is a new git repo (`main`, 2 commits): `README.md`, `.gitignore`,
  `loops.json`, `CLAUDE.md`, `REVIEW.md`. No code. No GitHub remote yet.
- gstack-loops is installed at `~/.claude/skills/gstack-loops` (origin
  `csakash/gstack-loops`, HEAD `c0091ef`). Pure Node, zero deps. Reusable pieces:

| Module | Reused as is | Not usable as is (why) |
|---|---|---|
| `lib/driver.js` | `runAgent`, `agentEnv` (push blocking), `AGENT_BIN`, `MODES` | `agentArgs` reviewer = `Read Grep Glob` only (`driver.js:23`); disprover needs web |
| `lib/review.js` | `extractJSON`, `ingest`, `openIds`, `counts`, `proofSections`, `nonEmptyFile` | `validateFindings` requires `file`+`line` (`review.js:51-52`); `resolveOne` requires a commit (`review.js:88`) |
| `lib/history.js` | `load`, `append`, `update`, `computeStats` (pointed at our own history file) | — |
| `lib/config.js`, `lib/util.js` | `loadConfig`, `readJSON`, `writeJSON`, `run`, `slugOk` | — |
| `lib/pipeline.js` | — | stage list is hard-coded for code (build/review/qa/buildgate/ship) |
| `gloop new/ls/drop` CLI | topic worktrees + registry | — |

Rule: gstack-loops is `require`d, never copied or edited. Anything research-specific lives here.

## Proposed change

A CLI, `rloop`, in this repo. One **research topic = one gloop loop** (branch `feat/r-<slug>`,
own worktree). A run is an ordered list of stages; each LLM stage is its own `claude -p`
process with a file contract; the runner checks the contract and picks the next stage.

```
scope ──► [HUMAN: pick sources + paper count] ──► map ──► detect
   ──► disprove ──► resolve ──┐  (≤ review.fixCycles, default 2)
          ▲                   │
          └───────────────────┘
   ──► citegate (no LLM) ──► rank ──► ship (PR) | stop
```

| Stage | Process | Tools | Must leave behind | Blocks when |
|---|---|---|---|---|
| `scope` | author | Read, Write, `Bash(rsearch:*)` | `brief.md`, `sources.json` | no source returns a count > 0 |
| gate | runner | — | `status.json` = `needs-human` | always, until `--papers N` given |
| `map` | runner fetch + author extract | Read, Write, `Bash(rsearch:*)` | `papers.jsonl`, `claims.jsonl` | < 80% of fetched papers processed; any claim fails schema |
| `detect` | runner signals + author | Read, Write | `signals.json`, `gaps.json` | 0 gaps, or a gap cites no claim |
| `disprove` | **reviewer, fresh** | Read, Grep, Glob, WebSearch, WebFetch, `Bash(rsearch:*)`; Edit/Write denied | findings JSON on stdout → `disprove/cycle-N.json` | tree changed (`BLOCKED: reviewer modified tree`) |
| `resolve` | author | Read, Write, `Bash(rsearch:*)` | `disprove/resolutions-N.json` | an open `kills` finding unresolved after the cap |
| `citegate` | runner, no LLM | — | `proof/citations.json`, `proof/search-coverage.json` | any cited ID fails to resolve; a surviving gap has < 10 disprover queries or < 2 sources |
| `rank` | author | Read, Write | `REPORT.md`, `gaps.json` scores | a surviving gap without all 4 scores |
| `ship` | runner, no LLM | git, gh | commit on topic branch; PR URL in `status.json` | mode is not autonomous (stops before push) |

### Sources (v1)

All keyless, fetched through one client (`lib/http.js`): per-host rate limit, 3 retries with
exponential backoff on 429/5xx, User-Agent `open-research/0.1 (+https://github.com/csakash/open-research)`,
disk cache under `.cache/` (gitignored). No email sent; optional `OPENALEX_MAILTO` /
`NCBI_API_KEY` / `S2_API_KEY` env vars if the user sets them.

| Source | count | search | resolve id | Fields |
|---|---|---|---|---|
| OpenAlex | yes | yes | `openalex:W…`, `doi:` | all |
| Semantic Scholar | yes | yes | `s2:`, `doi:` | all, strongest in CS/bio |
| arXiv | yes | yes | `arxiv:` | CS, physics, math, q-bio, econ |
| PubMed (E-utilities) | yes | yes | `pmid:` | biomedical |
| Europe PMC | yes | yes | `pmid:`, `pmcid:` | life sciences, open full text |
| Crossref | yes | no (metadata only) | `doi:` | all |
| ClinicalTrials.gov v2 | yes | yes | `nct:` | clinical |

`scope` picks sources for the topic (the author proposes, with a one-line reason each), the
runner runs `count` on each, and the gate shows the table. The user picks the paper count;
the runner splits it across chosen sources by count share, dedupes by DOI → OpenAlex ID →
normalized title, and tops up from the largest source if dedupe leaves a shortfall.

### `rsearch`: the only way agents touch databases

`bin/rsearch <count|search|resolve> <source> <query|id> [--limit N]` prints JSON and appends
`{ts, role, stage, source, op, query, results}` to `$RLOOP_RUN_DIR/search-log.jsonl`. The
disprover's search coverage is measured from this log, not from what it says it did.
WebSearch/WebFetch calls by the disprover are counted from the `claude -p` stream-json output.

### Data contracts

```jsonc
// claims.jsonl, one per line
{ "id": "c0001", "source": "doi:10.1000/xyz",
  "subject": "…", "relation": "increases|decreases|associated|no-effect|enables|other",
  "object": "…", "design": "rct|meta-analysis|observational|experiment|simulation|theory|review|other",
  "n": 120, "setting": "adults 65+, US", "quote": "≤ 40 words copied from the abstract" }

// gaps.json
[{ "id": "g01",
   "signal": "missing-link|weak-evidence|contradiction|narrow-coverage|method-transfer|newly-tractable|stated-limitation",
   "question": "one falsifiable question",
   "why": "what the evidence shows and what is missing",
   "claims": ["c0003","c0019"], "status": "open|dropped|survived",
   "scores": { "novelty": 1-5, "importance": 1-5, "tractability": 1-5, "evidence_gap": 1-5 },
   "rationale": { "novelty": "…", … } }]

// disprove/cycle-N.json (reviewer stdout)
{ "cycle": 1, "summary": "2 issues" | "no issues",
  "findings": [{ "id": "d1-01", "gap": "g03", "severity": "kills|weakens",
    "class": "answered-by-prior-work|known-impossible|trivial|mis-stated|already-in-progress",
    "summary": "…", "sources": ["doi:…"] }] }

// disprove/resolutions-N.json (author)
{ "d1-01": { "status": "dropped|rebutted", "reason": "…", "sources": ["doi:…"] } }
```

Mapping onto gloop's review store: `kills` → `important`, `weakens` → `nit`, so `ingest`,
`openIds`, `counts` are reused. Local validator replaces `validateFindings` (needs `gap` +
`sources`, not `file` + `line`). Local `resolveOne`: `dropped` needs a reason and sets the gap
to `dropped`; `rebutted` needs ≥ 1 source that resolves and is not one the finding cited.
Cycle ≥ 2 gives the disprover only gaps with a rebuttal plus the previous findings, with the
rule "do not re-report an id already listed".

### Detection signals computed in code (before the author)

`signals.json` gives the detect agent numbers, not vibes:
- **missing-link**: concept pairs (A, C) that each co-occur with some B in ≥ 3 claims but never
  with each other.
- **weak-evidence**: (subject, object) pairs with ≥ 3 claims and no `rct`/`meta-analysis`, or
  max `n` < 100.
- **contradiction**: pairs with claims in opposite directions (`increases` vs `decreases`/`no-effect`).
- **narrow-coverage**: pairs whose claims share a single `setting`.
- **stated-limitation**: phrases matched in abstracts ("future work", "remains unclear",
  "further research", "not yet been") grouped by concept.

`method-transfer` and `newly-tractable` are left to the author agent in v1.

### Run layout

- Working files: `<topic worktree>/.loops/runs/r-<slug>/<ISO>/` (gitignored), `latest` symlink,
  `status.json` after every stage.
- Committed on the topic branch at ship: `research/<slug>/REPORT.md`, `gaps.json`,
  `claims.jsonl`, `sources.json`, `brief.md`, `proof/` (citations, search coverage,
  disprove cycles, resolutions).
- History: one record per run appended to `<root>/.loops/research-history.json` via gloop's
  `history` module: `{slug, mode, papers, sources, outcome, blockedGate, cycles, gaps:
  {proposed, killed, survived}, citations: {checked, failed}}`. `rloop stats` reports
  survival rate and where runs block.

### CLI

```
rloop new "<topic>" [--slug s]        gloop new r-<slug> + writes research/<slug>/topic.md
rloop run <slug> [--mode interactive|bypass|autonomous] [--papers N] [--sources a,b] [--fix-cycles N] [--dry-run]
rloop ls                              topic loops: stage, paper count, gaps survived, PR
rloop stats [--json]                  survival rate, blocked gates, citation failure rate
```

Modes reuse gloop's meaning. All modes stop at the scope gate unless `--papers` is passed.
`interactive` prompts for the paper count in the terminal and asks before push. `bypass` stops
before push. `autonomous` pushes the topic branch and opens a PR whose body is `REPORT.md`
plus a proof summary. Only `ship` may push (gloop's `agentEnv` blocks push in every LLM stage).

## Acceptance criteria

1. `rloop new "sleep and procedural memory in older adults"` creates branch
   `feat/r-sleep-procedural-memory-older-adults`, a worktree, and `research/<slug>/topic.md`.
2. `rloop run <slug>` with no `--papers` ends with `status.json.outcome = "needs-human"`,
   `sources.json` listing ≥ 2 sources each with a numeric `count`, and prints a table of them.
3. `rloop run <slug> --papers 50 --mode bypass` runs every stage through `citegate` and `rank`,
   and stops before push with `outcome = "needs-human"` and `blockedGate = "push"`.
4. Every ID in `claims.jsonl`, `gaps.json`, and all `disprove/*` files appears in
   `proof/citations.json` with `resolved: true`; one fake DOI injected in a fixture run makes
   `citegate` block with `BLOCKED: citation doi:… did not resolve`.
5. Each `survived` gap has ≥ 10 disprover queries across ≥ 2 sources in `search-log.jsonl`
   (thresholds in `loops.json` under `research.disprove`); a fixture with 3 queries blocks.
6. A disprover run that edits any file ends `BLOCKED: reviewer modified tree`.
7. A `kills` finding left unresolved after `fixCycles` ends `BLOCKED: disprove did not
   converge after N cycles`, listing the open finding ids.
8. `--mode autonomous` on a topic with an `origin` remote opens a PR whose body contains
   `REPORT.md` and the proof summary; with no remote it stops `BLOCKED: no origin remote`.
9. `rloop stats` prints runs, survival rate (`survived / proposed`), and counts by blocked gate.
10. `npm test` (`node --test`) passes with zero network access: all source clients are tested
    against recorded fixtures in `test/fixtures/`.
11. No file under `~/.claude/skills/gstack-loops` is modified; `lib/gloop.js` is the only place
    that resolves its path (`GSTACK_LOOPS_DIR`, default `~/.claude/skills/gstack-loops`) and
    fails with a clear message if a required export is missing.
12. One live run on a real topic, `--papers 100`, completes; `REPORT.md` and its proof are
    attached to the loop's PR as evidence.
13. Each test in the Testing Plan states its card: `protects=…; fails_when=…; no_claim=…`.

## Testing plan

| Layer | What | Count |
|---|---|---|
| Unit | each source client: count/search/resolve parse recorded responses | +14 |
| Unit | `http.js`: rate limit spacing, retry on 429/503, cache hit | +4 |
| Unit | contracts: claim/gap/finding/resolution validators, accept + reject cases | +10 |
| Unit | signals: missing-link, weak-evidence, contradiction, narrow-coverage on a tiny claim set | +5 |
| Unit | resolve logic + gloop store mapping, convergence cap | +5 |
| Unit | citegate: resolve pass, fake ID fail, low search coverage fail | +4 |
| Integration | runner with a stub `claude` binary (`RLOOP_AGENT_BIN`) on fixtures: scope gate stop, full bypass run, reviewer-modified-tree block, non-convergence block | +4 |
| Live (manual, recorded in proof) | one real topic, 100 papers, bypass then autonomous | 1 |

## Rules for the implementing agent

1. Acceptance criteria are the `protects / fails_when / no_claim` profile of each test. Never "make the tests pass".
2. Real code and real tests land in the same change; no stubs or deferred tests.
3. Any change to a test, validator, threshold or timeout is reported on its own line with its justification.
4. A reported command names the command and its observed result; stderr is never silenced in a command you cite.
5. Your report is a claim until re-executed: say what you verified, what you reused, what you could not check.

## Files reference

| File | Change |
|---|---|
| `package.json` | name `open-research`, `bin: { rloop, rsearch }`, `test: node --test`, `build: node --check` over every `.js` file (gloop's buildgate runs `npm run build`), Node ≥ 18, no deps |
| `bin/rloop`, `bin/rsearch` | CLIs |
| `lib/gloop.js` | resolve + require gstack-loops modules, export check |
| `lib/http.js` | rate-limited, retrying, caching fetch |
| `lib/sources/{index,openalex,semanticscholar,arxiv,pubmed,europepmc,crossref,clinicaltrials}.js` | clients |
| `lib/contracts.js` | validators |
| `lib/signals.js` | code-computed gap signals |
| `lib/stages/{scope,map,detect,disprove,resolve,citegate,rank,ship}.js` | stages |
| `lib/runner.js` | stage runner, status.json, history |
| `prompts/{scope,extract,detect,disprove,resolve,rank}.md` | stage prompts |
| `test/**`, `test/fixtures/**` | tests + recorded API responses |
| `loops.json` | add `research: { disprove: { minQueries: 10, minSources: 2 } }` |
| `.gitignore` | add `.cache/` |

## Effort estimate (CC-assisted)

Sources + http + rsearch ~45 min · contracts + signals ~30 min · runner + stages ~60 min ·
prompts ~30 min · tests + fixtures ~45 min · live run + fixes ~45 min. About 4 h of loop time
(human team: ~2 weeks).

## Rollback

Nothing outside this repo changes. Revert the PR. Topic branches are independent; `gloop drop`
removes one.

## Out of scope (v1)

- Changing gstack-loops itself (a pluggable stage list there is a later PR, once this works).
- Running experiments or analyzing datasets to test a gap.
- Paywalled full text; non-English sources; patents; grey literature beyond preprints.
- A UI. Scheduled/recurring topic runs. Parallel-topic coordination beyond what gloop gives.
- Creating the GitHub remote from `rloop` (done once by hand: `gh repo create csakash/open-research --private`).
