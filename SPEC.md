# SPEC: oss-readme

Prepare the repo (renamed on GitHub from `open-research` to `rloop`) to be open-sourced.

## Must
1. `README.md` explains what rloop is, how the 8 stages work, why the output can be trusted,
   requirements, install, quickstart, commands, modes, config, env vars, outputs, an example
   report, limitations, development, contributing, license. Every command and fact in it
   matches the code.
2. Standard open-source files: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`,
   `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, issue and PR templates, a CI workflow that runs
   `npm test` and `npm run build`.
3. `package.json` names the package `rloop` and carries license, repository, homepage, bugs,
   keywords and author.
4. User-facing strings that say `open-research` say `rloop`: the HTTP User-Agent, the PubMed
   `tool=` parameter (fixtures updated to match), the workspace error message.

## Must not
- Change pipeline behavior.
- Rename the `loops.json` repo name: existing loop worktrees live under `worktrees/*/open-research`.
- Put a personal email anywhere in the repo.

## Done when
`npm test` and `npm run build` pass, and every command in the README runs as written.
