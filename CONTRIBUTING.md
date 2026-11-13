# Contributing to rloop

Thanks for helping. Bug reports, new database sources, better gap signals and docs fixes are
all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Set up

Follow [Install](README.md#install) in the README, then:

```bash
npm test        # offline: recorded fixtures + a stub agent, no network or Claude usage
npm run build   # syntax and file-contract checks
```

Both must pass before a PR is merged. CI runs them on every push and pull request.

## What we care about

These rules are what keep rloop's reports trustworthy. A change that weakens one of them
needs a very good reason in the PR description.

- **Evidence is checked by code.** Every citation carries a resolvable ID (DOI, PMID,
  OpenAlex or arXiv) and every quote is matched against its abstract in `lib/citegate.js`,
  never by an agent.
- **Search counts come from the signed log.** A gap is never reported as novel unless the
  disprover's searches are in `search-log.jsonl`.
- **The disprover is read-only.** It may search and read, and returns its findings as text.
  It must never change the tree.
- **Be polite to databases.** Every new client goes through `lib/http.js` (per-host rate
  limit, retries with backoff, User-Agent, cache).
- **gstack-loops is required, never copied.** Reuse it through `lib/gloop.js`. Behavior that
  differs belongs in this repo's own modules.

More detail is in [REVIEW.md](REVIEW.md), which is also what automated reviewers check
against.

## Adding a database source

1. Add a client in `lib/sources/<name>.js` that uses `lib/http.js`, and register it in
   `lib/sources/index.js`.
2. Add an entry for the source to `PLAN` in `scripts/record-fixtures.js`, record fixtures
   with `node scripts/record-fixtures.js <name>`, and add tests in `test/sources.test.js`.
   Tests must not hit the network.
3. Add the source to the tables in the README, with any optional key it reads.

## Changing the agent sandbox

The tests use a stub agent, so they can't tell you whether the real CLI respects the
sandbox. After any change to `lib/agent.js` or `bin/rsearch`, run:

```bash
node scripts/probe-sandbox.js
```

against a real, logged-in `claude` CLI, and say in the PR that you did.

## Pull requests

- Keep each PR to one change, and explain why in the description.
- Add or update tests for behavior changes.
- Update the README and [CHANGELOG.md](CHANGELOG.md) when user-facing behavior changes.
- Don't commit `.env` files, API keys, `.cache/`, or `.loops/`.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE)
and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
