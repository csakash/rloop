# Security policy

rloop runs AI agents on your machine and gives them a restricted set of tools. Bugs that let
an agent step outside that box are the ones we care about most.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
[Report a vulnerability](https://github.com/csakash/rloop/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. You
should get a reply within 7 days. Once a fix ships, we'll credit you in the advisory unless
you'd rather stay anonymous.

## In scope

- An agent running a command other than `rsearch`, or reading or writing outside its stage
  directory.
- An agent reading database API keys or the search-log signing key.
- Forging or editing the signed search log without detection.
- A citation or quote that passes `citegate` without actually resolving or matching.
- Secrets reaching a pushed branch or PR body despite the pre-push scan.
- Topic text, paper content or abstracts that steer an agent into any of the above (prompt
  injection).

## Out of scope

- Bugs in gstack-loops, gstack, or the Claude Code CLI themselves. Please report those to
  their projects.
- Rate-limit or availability issues with the public databases.

## Supported versions

Only the latest release on `main` gets security fixes.
