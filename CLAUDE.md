## gstack-loops (loop-engineering)

This workspace uses [gstack-loops](https://github.com/csakash/gstack-loops) on top of
[gstack](https://github.com/garrytan/gstack). Repos: open-research.

**Every feature is a loop. Never edit `main` or the root checkouts directly** — parallel
sessions share these repos; an isolated worktree per loop is what stops them clobbering each
other. Start each feature with `gloop new <slug>`, then work inside `worktrees/<slug>/`.

The loop: `/gloop-spec` (commit `SPEC.md`) → `/gloop-build` (build → fresh-context review
and security review → `/qa`, with proof) → `/gloop-ship` (raise the PR). There's a
`/gloop-*` shortcut for every step, or just `/gloop <what you want>` to drive it
conversationally. For headless runs use `gloop run <slug> --mode <interactive|bypass|autonomous>`.

- Use `/browse` for all web browsing/QA — never `mcp__claude-in-chrome__*`.
- Definition of Done: behavior matches `SPEC.md`; `PROOF.md` (Testing / Risk / How to revert)
  is the PR body; `npm run build` clean per repo; review and security review converged, every
  important finding fixed or closed with a reason; each repo's `REVIEW.md` followed; sensitive
  paths flagged for a human reviewer (`gloop risk`); no `.env` committed; cross-repo PRs
  cross-linked.
- Landing several PRs at once: see [docs/PARALLEL_SHIPPING.md](docs/PARALLEL_SHIPPING.md)
  (shared-DB isolation via `hooks.preLoop`, merge order, rebase-before-ship).
- After a loop's PR merges: `gloop reap` (records the merge, re-checks recent merges for
  reverts). `gloop stats` shows how loops are doing.
