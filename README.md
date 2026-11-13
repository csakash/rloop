# rloop

**Agents that read the research for you, find the open questions, and try hard to prove themselves wrong.**

[![CI](https://github.com/csakash/rloop/actions/workflows/ci.yml/badge.svg)](https://github.com/csakash/rloop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)

rloop is a command-line pipeline for **research-gap discovery**. You give it a topic. It pulls
real papers from public databases, turns them into claims with exact quotes, finds where the
evidence is thin or contradicts itself, and then sends a second, independent agent to find
papers that already answer each gap. Only the gaps that survive land in a report, and every
citation in that report is checked by plain code, not by AI.

```text
topic ─▶ scope ─▶ gate ─▶ map ─▶ detect ─▶ disprove ⇄ resolve ─▶ citegate ─▶ rank ─▶ ship
                  (you)                    (fresh agent attacks      (code only)        (PR)
                                            every gap)
```

Read a real report: [sleep and procedural memory in older adults](research/sleep-and-procedural-memory-in-older-adults/REPORT.md).

---

## Contents

- [Why rloop](#why-rloop)
- [How it works](#how-it-works)
- [Why you can trust the output](#why-you-can-trust-the-output)
- [Requirements](#requirements)
- [Install](#install)
- [Quickstart](#quickstart)
- [Commands](#commands)
- [Modes](#modes)
- [Configuration](#configuration)
- [What a run produces](#what-a-run-produces)
- [A real run](#a-real-run)
- [Limitations](#limitations)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why rloop

Any model can tell you "nobody has studied this". It is usually wrong, and it can't show you
why it thinks so.

rloop makes that claim earn its place:

- **It reads papers, not threads.** Sources are peer-reviewed literature, preprints and trial
  registries, not Reddit or news.
- **It argues against itself.** A separate agent with no memory of the author searches for
  work that already answers each gap. A gap it can kill is dropped. A gap it can partly answer
  is narrowed to the part still open.
- **Its evidence is checked by code.** Paper IDs must resolve, quotes must appear word for
  word in the abstract, and search counts come from a signed log, not from what an agent says
  it did.
- **A human stays in charge.** You choose how many papers to read, and the report arrives as a
  pull request for you to review.

Use it to pick what to build next, to find a thesis topic, or to check whether an idea is
already solved before you spend weeks on it.

## How it works

Each research topic is its own git branch and worktree (a
[gstack-loops](https://github.com/csakash/gstack-loops) loop). A run goes through 8 stages:

| # | Stage | Who | What happens |
|---|---|---|---|
| 1 | **scope** | agent | Picks the databases that fit the topic and writes search queries. Code counts how many papers each query finds. |
| 2 | **gate** | you | Nothing is downloaded until you choose how many papers to use (and, optionally, which sources). |
| 3 | **map** | code + agents | Fetches papers with a fair split across sources (each gets at least 10%), then agents turn each abstract into short claims, each with an exact quote. |
| 4 | **detect** | code + agent | Code computes signals (thin evidence, contradictions, missing links). An agent writes them up as specific, answerable questions. |
| 5 | **disprove** | fresh agent | Searches across databases for papers that already answer each gap. Each finding *kills*, *weakens*, or finds nothing. |
| 6 | **resolve** | author agent | Must drop a killed gap, narrow a weakened one to its open part, or rebut with cited evidence. Loops back to disprove until no kill is left open. |
| 7 | **citegate** | code only | Every paper ID must resolve in a real database and every quote must appear in its abstract. Any miss blocks the run. |
| 8 | **rank** + **ship** | agent + git | Survivors are scored on novelty, importance, tractability and evidence gap (1 to 4 each; the score is their product), `REPORT.md` is written, and the run is committed and opened as a PR. |

### Sources

| Database | Search | Count | Key (optional) |
|---|---|---|---|
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) | yes | yes | `NCBI_API_KEY` |
| [Europe PMC](https://europepmc.org/) | yes | yes | none |
| [OpenAlex](https://openalex.org/) | yes | yes | `OPENALEX_API_KEY`, `OPENALEX_MAILTO` |
| [Semantic Scholar](https://www.semanticscholar.org/) | yes | yes | `S2_API_KEY` |
| [arXiv](https://arxiv.org/) | yes | yes | none |
| [ClinicalTrials.gov](https://clinicaltrials.gov/) | yes | yes | none |
| [Crossref](https://www.crossref.org/) | no | yes | `CROSSREF_MAILTO` |

All of them work without a key. Keys and contact emails only raise rate limits or put you in
a database's "polite pool".

## Why you can trust the output

**Checked by code, not AI**
- Every quote is found word for word in its paper's abstract.
- Every DOI, PMID, OpenAlex or arXiv ID resolves in a real database. No ID, no citation.
- Disprover search counts come from the search log, not from the agent's own account. A gap
  needs at least 10 searches across at least 3 databases (15 if related work turned up), or
  it does not ship.

**Agents are boxed in**
- Each agent runs in a fresh, empty temp directory holding only copies of that stage's
  inputs. Only its declared outputs are copied back.
- The only command an agent can run is `rsearch`, a read-only database client.
- Every `rsearch` call is written to a search log signed with a per-run HMAC key the agents
  can't read.
- The disprover starts from a fresh context, so it has no reason to go easy on the author.

**You stay in charge**
- You pick how many papers to read before anything is fetched.
- The report lands as a pull request for review.
- Nothing is pushed without your yes, unless you choose `autonomous` mode.
- Before any push, everything on the branch is scanned for credential patterns and for the
  values of your API keys. A hit blocks the push.
- If anything fails (a bad citation, a thin search, an open kill), the run stops and asks you
  instead of shipping.

## Requirements

- **Node.js 18+**. No npm dependencies.
- **[Claude Code](https://docs.claude.com/en/docs/claude-code) CLI** (`claude`), logged in.
  Every agent stage runs through it, so **runs use your Claude usage**. Budget for it.
- **[gstack-loops](https://github.com/csakash/gstack-loops)**, which provides `gloop` (the
  worktree, agent-driver and history layer rloop is built on), and
  **[gstack](https://github.com/garrytan/gstack)**, which gstack-loops requires.
- **git**, and **[GitHub CLI](https://cli.github.com/)** (`gh`, authenticated) to open PRs
  with `rloop ship`.
- macOS or Linux. Windows is untested.

## Install

1. Install gstack by following [its README](https://github.com/garrytan/gstack).

2. Install gstack-loops:

   ```bash
   git clone --depth 1 https://github.com/csakash/gstack-loops.git ~/.claude/skills/gstack-loops && cd ~/.claude/skills/gstack-loops && ./setup
   ```

   rloop looks for it at `~/.claude/skills/gstack-loops`. If you put it somewhere else, set
   `GSTACK_LOOPS_DIR`.

3. Clone rloop:

   ```bash
   git clone https://github.com/csakash/rloop.git && cd rloop
   ```

4. Put `rloop` on your PATH (optional, otherwise use `./bin/rloop`):

   ```bash
   npm link
   ```

5. Check it works:

   ```bash
   npm test
   ```

## Quickstart

Run everything from the root of your rloop clone.

```bash
# 1. Start a topic. This creates a loop: branch feat/r-<slug> in worktrees/r-<slug>/
rloop new "sleep and procedural memory in older adults"

# 2. Run it. scope runs, then the gate asks how many papers to use.
rloop run sleep-and-procedural-memory-in-older-adults

# 3. Not in a terminal, or want to decide later? The run stops at the gate. Resume with a count:
rloop run sleep-and-procedural-memory-in-older-adults --papers 100

# 4. Before pushing it asks. Said no, or ran headless? Read REPORT.md, then publish it as a PR:
rloop ship sleep-and-procedural-memory-in-older-adults
```

**Write specific topics.** Paper abstracts are written to be found: they pack in the exact
terms of their field. "AI memory" will pull in noise. "Persistent graph-based memory for LLM
agents" will pull in the right papers. `rloop new` prints the path of the topic's `topic.md`
(inside its worktree). Add scope notes under the title there before the first run.

**Start small.** Try `--papers 30` first. Cost grows with the number of papers and gaps.

## Commands

| Command | What it does |
|---|---|
| `rloop new "<topic>" [--slug s]` | Create a topic: a new loop, branch and worktree, plus `research/<slug>/topic.md`. |
| `rloop run <slug>` | Run (or resume) the pipeline for a topic. |
| `rloop ship <slug>` | Publish a run that stopped before push: commit, push, open the PR. |
| `rloop ls` | List topics with their latest outcome, stage, paper count and gaps survived. |
| `rloop stats [--json]` | Outcomes across all runs, gap survival rate, citation failures, where runs block. |

`rloop run` options:

| Flag | Default | Meaning |
|---|---|---|
| `--mode <m>` | `interactive` | `interactive`, `bypass` or `autonomous` (see [Modes](#modes)). |
| `--papers <N>` | asks | How many papers to fetch. Answers the gate. |
| `--sources a,b` | all usable | Restrict to these sources (must be ones scope picked). |
| `--fix-cycles <N>` | from `loops.json` | Disprove and resolve rounds before giving up. |
| `--fresh` | off | Start a new run instead of resuming one stopped at the gate. |
| `--dry-run` | off | Print the stages that would run and the disprove bar, then exit. |

Exit codes: `0` finished or stopped for a human, `2` blocked by a failed check, `1` usage error.

## Modes

| Mode | Behavior |
|---|---|
| `interactive` | Asks you at the gate, and asks before pushing. Say no and publish later with `rloop ship`. |
| `bypass` | Headless. Stops at the gate unless `--papers` is given, and stops before pushing. |
| `autonomous` | Headless, end to end, opens the PR itself. Needs `--papers`. |

## Configuration

### `loops.json`

The `research` block sets the disprover's bar:

```json
"research": {
  "disprove": {
    "minQueries": 10,
    "minSources": 3,
    "extraQueriesIfFinding": 5
  },
  "signals": {}
}
```

- `minQueries`: searches the disprover must run per gap.
- `minSources`: distinct databases those searches must cover.
- `extraQueriesIfFinding`: extra searches required when it turns up related work.

`review.fixCycles` is the default for `--fix-cycles`. The rest of `loops.json` is
[gstack-loops config](https://github.com/csakash/gstack-loops#config-loopsjson).

### Environment variables

All optional.

| Variable | Purpose |
|---|---|
| `NCBI_API_KEY` | PubMed key. Raises the rate limit. |
| `OPENALEX_API_KEY`, `OPENALEX_MAILTO` | OpenAlex key and contact email (polite pool). |
| `S2_API_KEY` | Semantic Scholar key. Raises the shared public rate limit. |
| `CROSSREF_MAILTO` | Crossref contact email (polite pool). |
| `GSTACK_LOOPS_DIR` | Where gstack-loops is installed. Default `~/.claude/skills/gstack-loops`. |
| `RLOOP_CACHE=off` | Disable the HTTP response cache. |
| `RLOOP_CACHE_DIR` | Where to cache responses. Default `.cache/` in the repo. |
| `RLOOP_THROTTLE_DIR` | Where the cross-process rate-limit locks live. Default `~/.cache/rloop/throttle`. |

Database keys never enter an agent's environment. They sit in an owner-only file outside
every agent's working directory, and `rsearch` loads them itself.

rloop is polite by default. Requests are rate limited per host, shared across every process on
the machine (arXiv's 1 request per 3 seconds holds even with many agents searching at once),
retried with backoff on 429 and 5xx (honoring `Retry-After`), and sent with a User-Agent that
identifies rloop.

## What a run produces

The report is committed under `research/<slug>/` on the topic's branch:

| File | Contents |
|---|---|
| `REPORT.md` | Ranked surviving gaps: the question, the evidence it rests on with quotes and IDs, the disprover's result, and the score rationale. |
| `brief.md` | How scope read the topic: synonyms, what is in and out of scope. |
| `papers.jsonl` | Every paper fetched, with its IDs. |
| `claims.jsonl` | Every claim, with the exact quote it came from. |
| `gaps.json` | Gaps, their history (narrowed, dropped) and scores. |
| `disprove/` | Each disprove cycle: findings, and the tools the disprover used. |
| `search-log.jsonl` | Every database search, signed. |
| `proof/` | Citation, quote and search-coverage checks. |

Working state for each run lives in `.loops/runs/` (git-ignored).

## A real run

Topic: *sleep and procedural memory in older adults*. Full report:
[`research/sleep-and-procedural-memory-in-older-adults/REPORT.md`](research/sleep-and-procedural-memory-in-older-adults/REPORT.md).

- 100 papers from PubMed, Europe PMC, OpenAlex and ClinicalTrials.gov
- 129 claims extracted, 129 quotes verified against abstracts
- 90 citations checked by code, 0 unresolved
- 10 gaps proposed, 10 survived, 8 narrowed to their open part

The top gap, in plain words: for healthy adults over 65, does a night of sleep help a
whole-hand movement task more than a finger-tapping task? And is the well-known finding that
"older adults don't benefit from sleep" really a finger-dexterity effect? The studies point
every way (no effect, harm, benefit), and no study has crossed task type with a properly timed
sleep-versus-wake design in the same people. The disprover ran 11 searches across 6 databases
and found nothing that answers it.

## Limitations

- **Abstracts, not full text.** Claims and quote checks use titles and abstracts. A gap can
  look open when the answer is buried in a paper's results section.
- **A surviving gap is not proof of novelty.** It means a determined search across these
  databases found nothing. Treat the report as a well-sourced starting point, and read the
  key papers yourself before you commit.
- **Claude Code only.** The agent driver comes from gstack-loops and only supports the
  `claude` CLI today.
- **Cost.** Runs use your Claude usage, and large paper counts get expensive.
- **Narrowed gaps.** After a gap is narrowed, searches made against its earlier wording still
  count toward the disprover's bar.

## Development

```bash
npm test        # node --test test/*.test.js
npm run build   # node scripts/check.js: syntax and file-contract checks
```

Tests run offline against recorded fixtures in `test/fixtures/` and a stub agent
(`test/stub-claude.js`), so they need gstack-loops installed but no network or Claude usage.

Layout:

```text
bin/rloop          CLI
bin/rsearch        the only command agents may run (read-only database client)
lib/stages/        one module per pipeline stage
lib/sources/       one client per database
lib/citegate.js    code-only citation and quote checks
lib/searchlog.js   HMAC-signed search log
lib/agent.js       per-stage agent sandbox
prompts/           the prompt for each agent role
scripts/           build check, fixture recorder, sandbox probe
```

If you change how agents are sandboxed, re-run `node scripts/probe-sandbox.js` against a real,
logged-in `claude` CLI. The tests use a stub and can't tell you whether the real CLI respects
the rules.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Good first areas:
new database sources, better signals in `detect`, and support for agents other than Claude
Code.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security issue, see
[SECURITY.md](SECURITY.md), and please don't open a public issue for it.

## License

[MIT](LICENSE) © 2026 Akash Munshi

Papers and abstracts fetched by rloop belong to their authors and publishers, and each
database has its own terms of use. Check them before you redistribute fetched content.

## Acknowledgements

Built on [gstack-loops](https://github.com/csakash/gstack-loops) and
[gstack](https://github.com/garrytan/gstack). Thanks to PubMed, Europe PMC, OpenAlex,
Semantic Scholar, arXiv, ClinicalTrials.gov and Crossref for keeping research open and
searchable.
