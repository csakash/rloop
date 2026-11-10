# REVIEW.md

What gstack-loops' reviewer should care about in this repo. Keep it short.

## What failure looks like here
- A gap report cites a source that does not exist or does not say what is claimed. Every
  citation must carry a resolvable ID (DOI / OpenAlex / PMID / arXiv) and be checked by code.
- A gap is reported as novel when the disprover stage did not actually run its searches
  (search log missing or empty).
- Reused gstack-loops code is copied and edited instead of required; local changes to its
  behavior must live in this repo's own modules.
- The disprover stage can write files or change the tree. It must be read-only plus web/API.
- API calls without rate limiting, retries with backoff, or a polite User-Agent.

## Do not nitpick
- Formatting and naming. Style with no effect on behavior.

## Ignore
- Lockfiles, cached API responses under `.cache/`, generated run output under `.loops/`.

## How to report
- Every finding names a file and a line. Never guess a filename.
- Start with a summary that gives the count, or says exactly "no issues".
