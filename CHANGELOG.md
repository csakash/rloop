# Changelog

All notable changes to rloop are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Renamed from `open-research` to `rloop`. The HTTP User-Agent and PubMed `tool` parameter now
  identify as `rloop`.

### Added
- README, license (MIT), contributing guide, security policy, code of conduct, and issue and
  PR templates.

## [0.1.0] - 2026-11-12

### Added
- `rloop` CLI: `new`, `run`, `ship`, `ls`, `stats`.
- 8-stage pipeline: scope, gate, map, detect, disprove and resolve, citegate, rank, ship.
- Sources: PubMed, Europe PMC, OpenAlex, Semantic Scholar, arXiv, ClinicalTrials.gov, and
  Crossref (counts only).
- Code-only citation and quote checks, an HMAC-signed search log, a per-stage agent sandbox,
  and a per-host rate limit shared across processes.
