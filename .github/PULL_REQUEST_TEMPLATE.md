## What and why

## How it was tested
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] If `lib/agent.js` or `bin/rsearch` changed: ran `node scripts/probe-sandbox.js` against a real `claude` CLI

## Checklist
- [ ] Citations and quotes are still checked by code, not by an agent
- [ ] New network calls go through `lib/http.js`
- [ ] README and CHANGELOG updated if user-facing behavior changed
- [ ] No API keys, `.env`, `.cache/` or `.loops/` committed
