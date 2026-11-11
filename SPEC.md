# SPEC: rloop-shared-throttle

## Problem

`lib/http.js` throttles each host (arXiv 3.1 s, others per `SPACING`) with an in-memory timestamp. That holds only inside one process. During a run, every database call an agent makes is a separate `rsearch` process, and an agent can run several at once, so a run can send several requests to arXiv at the same time and closer together than 3 s. arXiv's API terms ask for one connection at a time and at most one request every 3 s. On 2026-11-11 this machine was rate-limited (HTTP 429) for about 40 minutes.

## Behaviour

1. **One request at a time per host, across processes.** Every uncached `http.get` to a host holds a per-host lock for the duration of the fetch. Any other process (or concurrent call in the same process) that wants the same host waits. Different hosts don't block each other.
2. **Spacing across processes.** Each host has a shared "next allowed" time. A request starts no earlier than that time. After each attempt, it is set to `end + SPACING[host]` (default 1000 ms).
3. **Server back-off is shared.** On 429 or 5xx, "next allowed" becomes at least `end + Retry-After` (capped at 60 s), or the existing exponential back-off when there is no header. Every process then waits, not just the one that got the 429.
4. **The lock is only held during the request.** Waiting for "next allowed" happens with the lock released, so a long cooldown can't make a lock look stale.
5. **Stale locks recover.** A lock older than 90 s (three times the 30 s request timeout) is treated as abandoned and removed. A crashed process can't block a host forever.
6. **Shared location.** The state lives in `RLOOP_THROTTLE_DIR`, defaulting to `~/.cache/rloop/throttle`, so it is shared across runs and checkouts on the machine. The runner passes the same directory to every agent's `rsearch`. Host names are sanitised before being used as file names.
7. **Cache hits are unaffected:** no lock, no wait.
8. **Fail safe, not open.** If the throttle directory can't be created or written, `get` falls back to the in-process throttle and says so once on stderr. It never sends faster than before.

## Out of scope

- Changing `SPACING` values or retry counts.
- Rate limits across machines.

## Done when

- Unit tests: cross-process serialisation (two real child processes against a local HTTP server never overlap, and starts are at least the spacing apart); shared Retry-After back-off; stale-lock recovery; hosts independent; cache hits skip the lock; fallback when the directory is unwritable.
- `npm test` and `npm run build` are clean.
- Fresh-context review and security review converge.
