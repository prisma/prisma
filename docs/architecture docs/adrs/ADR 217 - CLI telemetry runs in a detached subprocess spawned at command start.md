# ADR 217 — CLI telemetry runs in a detached subprocess spawned at command start

## Status

Accepted. CLI telemetry subprocess pattern is implemented as described in [`docs/Telemetry.md`](../../Telemetry.md), which is the user-facing reference for the telemetry surface this ADR scopes. This ADR is the engineering-architecture companion to [ADR 216 — CLI telemetry installation ID is a stored random UUID](./ADR%20216%20-%20CLI%20telemetry%20installation%20ID%20is%20a%20stored%20random%20UUID%20not%20a%20system%20fingerprint.md). It does not cover crash/error reporting, which is Phase 2 of the project and is expected to require a different isolation contract (synchronous-flush-before-exit rather than fire-and-forget).

## At a glance

The CLI parent process forks a detached child via `child_process.fork()` immediately after argument parsing, sends a small payload over IPC, calls `disconnect()` and `unref()`, and proceeds with its real work. The child does all work that requires I/O (system probing, project `package.json` read for TS version, HTTPS POST to the telemetry backend) and exits when finished. The two halves never share an event loop. The parent's exit time is independent of any telemetry operation, including operations that fail or hang.

```text
parent process                               detached child process
──────────────                               ──────────────────────
parse argv ──────► fork(senderPath)
                   send(payload via IPC)
                   disconnect(); unref()
                   ───────────────────────►  receive payload
do real work                                  probe system
(unblocked from here)                         read project package.json
                                              POST to backend (timeout 1–2s)
exit when work is done                        swallow all errors
                                              exit
```

Spawn happens at **command start**, not at command exit. Telemetry events fire concurrently with the parent's real work; the child does not depend on whether the parent completes successfully, partially, or crashes.

## Context

The CLI Telemetry project's strict isolation contract requires that no telemetry-path failure can affect CLI exit time, output, or exit code, and that telemetry never blocks CLI exit by even a few milliseconds. The contract is load-bearing for the project's trust posture: a single user-visible telemetry failure (a 30-second DNS hang on a flight, a stack trace from a corporate-proxy fetch, a 2-second perceived slowdown during a backend outage) costs more reputational capital than a year of clean data collection earns. The implementation therefore needs to make those failure modes impossible by construction, not merely "handled with try/catch".

Three implementation shapes were considered.

### Option A — synchronous in-process with timeout

`await fetch(...).timeout(1000)` from inside the parent before its main work. Rejected immediately: any timeout > 0 perceived as latency on every CLI invocation, exactly the user-experience problem the contract forbids.

### Option B — in-process fire-and-forget via `unref()`

```ts
const req = https.request(url, ...);
req.end(payload);
req.socket?.unref();
req.unref();
// parent continues
```

This is the conventional approach for CLI telemetry in many OSS tools and is what we'd use for "the simplest possible implementation". It has a subtle failure mode that disqualifies it for our isolation contract:

- The HTTP request runs inside the parent's event loop. When the parent's main work finishes, the event loop drains. If the request is still in flight at drain time, the socket is closed mid-send and the event is lost.
- For long-running commands (`migration-new`, `contract-emit`), the loss rate is acceptable — the command takes seconds, the request completes well within the window.
- For instant-exit commands (`prisma-next --help`, `prisma-next --version`), the parent exits in tens of milliseconds, often before the TCP handshake completes. Loss rate is high.
- These instant-exit invocations are exactly the events we want to count for MAU — they are the canonical "is anyone running this?" signal.

There is also a softer concern: the in-process approach couples the parent's exit time to the network. Even when the request *does* succeed in flight before the parent exits, the parent's perceived exit time has a component proportional to network state. A user running the CLI in a slow-network environment doesn't see a hang, but does see the CLI feel ~50–200ms heavier than the same command with telemetry disabled. The contract forbids this category of effect, even when bounded.

Three further variants of in-process fire-and-forget were considered:

- **Keep the event loop alive with a deferred `process.exit()`** — defeats `unref()` by re-introducing exit-time coupling. Rejected.
- **Buffer events to disk and flush on next invocation** — introduces a queue, queue corruption, disk-growth concerns, and an in-process retry surface. The spec explicitly forbids on-disk queueing (NFR6). Rejected.
- **Synchronous send with a hard 100ms timeout** — measurable user-perceived latency on every invocation. Rejected.

### Option C — detached subprocess

`child_process.fork()` of a tiny sender script. The parent ships the payload over IPC, disconnects, unrefs the child handle, and continues. The child has its own event loop and process lifetime; whatever it does (or fails to do) is invisible to the parent. The parent exits when *its* work is done, on *its* schedule, regardless of any I/O the child is doing.

This is the option the spec adopts. It is the **only** option that makes the strict isolation contract impossible to violate by construction rather than dependent on the implementer's diligence about `unref()` ordering, abort signals, and event-loop drain semantics.

### Why `fork()` rather than `spawn(execPath, ...)`

The child must run on the same runtime as the parent. The CLI ships to Node, Bun, and Deno users; an installation that runs `bun prisma-next ...` cannot reach for `node` to run the sender because Bun users frequently do not have Node installed. Hardcoding `process.execPath` with a manual argv arrangement works but is brittle across runtimes (the correct `argv[0]`/`argv[1]` shape differs, the Bun and Deno wrappers around Node-compat have edge cases around module resolution). `child_process.fork()` is the API that already encapsulates this concern: it spawns the same runtime as the caller, sets up the IPC channel, and handles the inter-runtime variations correctly. Bun and Deno both implement `child_process.fork()` in their Node-compat layers with the expected semantics.

### Why spawn at command start, not at command exit

The conventional pattern is to spawn telemetry at the *end* of a command (so the event payload can include outcome — exit code, duration, success/failure). The Phase 1 field list has zero outcome-dependent fields (the user-facing field list is at [`docs/Telemetry.md`](../../Telemetry.md)), so the conventional pattern's main advantage is unused. Spawning at command *start* has two real advantages:

- **Zero perceived spawn cost.** Process spawn takes ~30–80ms on Node and less on Bun. When the spawn happens after the parent has completed its main work, that cost is wholly attributable to telemetry and adds to the user-perceived CLI runtime. When the spawn happens *at command start*, in parallel with the parent's main work, the spawn completes concurrently with work the user is waiting for anyway. The user perceives nothing extra.
- **Crash-resilient counting.** A command that crashes 200ms into a long-running operation still contributes to MAU, because the telemetry fork happened before the crash. The conventional pattern would lose this event entirely — the command crashed before the telemetry hook ran.

Outcome-dependent events (success/failure, duration, error category) are inherently the domain of crash/error reporting, which Phase 2 will handle with its own isolation contract designed for that purpose.

### Why field collection is split between parent and child

The parent contributes fields it has *naturally in hand* by the time argument parsing completes: the parsed command name, the parsed flag names (sanitization-clean by construction), and any config values already loaded as part of normal CLI operation (database target from the resolved `prisma-next.config.ts`, list of registered extensions). The child contributes everything else: system probes (`process.arch`, `process.platform`, runtime name + version, package manager from `npm_config_user_agent`), any I/O that requires reading user-project files (TS version from project `package.json`), agent-detection env-var lookups, and the HTTPS POST.

This split is **a separation-of-responsibilities decision, not an efficiency one**. The parent's job is to do what the user asked. The child's job is telemetry. Things the parent has anyway flow through; everything else stays on the child's side of the wall. The discipline matters because "but it's already in memory" optimisations erode the boundary over time — five years from now, an audit should be able to confirm in one read that the parent's telemetry code is exactly "collect what's already on hand, fork the child" and nothing more.

## Decision

### Spawn mechanics

The CLI client packages a tiny sender script (~50 lines) under its `dist/` directory. After argument parsing completes and before main command execution begins, the parent calls:

```ts
const child = fork(senderPath, [], {
  detached: true,
  stdio: ['pipe', 'ignore', 'ignore', 'ipc'],
});
child.send(payload);
child.disconnect();
child.unref();
// parent continues immediately
```

The `detached: true` flag puts the child in its own process group so the parent's exit does not signal it. `stdio: 'ignore'` for stdout/stderr ensures no child output can ever reach the user's terminal. The `'ipc'` channel carries the payload exactly once. `disconnect()` closes the IPC channel from the parent's side, `unref()` removes the child from the parent's reference count so the parent is free to exit without waiting.

### Payload contents (parent contribution)

- The parsed command name and the parsed flag names (no values, no positionals — see [`docs/Telemetry.md`](../../Telemetry.md) for the user-facing rule).
- Already-loaded config-derived fields: database target from `config.target.targetId`, official-allowlist extension names plus non-allowlist count.
- The installation UUID read from disk (per [ADR 216](./ADR%20216%20-%20CLI%20telemetry%20installation%20ID%20is%20a%20stored%20random%20UUID%20not%20a%20system%20fingerprint.md)).
- The Prisma Next version (from the client package's own `package.json`).

### Sender script behaviour (child)

The child receives the parent's payload over IPC, then enriches it with fields it owns:

- System probes: `process.arch`, `process.platform`, runtime name (Node / Bun / Deno) and version, package manager from `npm_config_user_agent`.
- I/O: TypeScript version resolved from the user's project `package.json`; null on any failure.
- Agent detection: env-var allowlist of known AI-coding tools; null on no match.

The child then issues a single HTTPS POST to the telemetry endpoint with a hard 1–2-second timeout (plan-phase decides which end of the range). On any error — timeout, DNS failure, non-2xx response, malformed response — the child swallows the error silently and exits. The only path where the child produces visible output is when `PRISMA_NEXT_DEBUG=1` is set, in which case it may emit diagnostic logging to its own stdout (which is `'ignore'`d from the parent's perspective; users see the debug output only when they explicitly route the child's stdio elsewhere or run the sender script directly).

### Failure model

Every step of the child's work is best-effort. Step failures contribute null fields, not exceptions. A child that cannot read TS version sends `tsVersion: null`. A child that cannot reach the backend exits without sending. There is no on-disk queue, no retry, no resumable state. The system is robust to bounded event loss at MAU granularity.

### Test environments

Test suites short-circuit the entire path. The mechanism is plan-phase (likely reuse of the `PRISMA_NEXT_DISABLE_TELEMETRY` env var, set once in the test harness setup) but the requirement is firm: tests must never fork the sender.

## Consequences

### Positive

- **Strict isolation contract is satisfied by construction.** Parent and child do not share an event loop. The parent cannot be slowed, delayed, hung, error-stained, or exit-coded by anything the telemetry path does. A reviewer can confirm this from the architecture alone — no need to audit every branch of the sender script.
- **Failure modes that have historically broken OSS tool telemetry are impossible here.** No DNS hang on a flight (the parent doesn't wait for DNS). No proxy stack trace (no child output reaches stdio). No exit-code change on backend outage (the parent never observes the child's exit). No perceived slowdown during release-window backend issues (the parent's exit time has no network-coupled component).
- **Crash-resilient MAU counting.** Commands that crash mid-execution still contribute their event. This eliminates a systematic undercount that the conventional spawn-at-exit pattern would introduce.
- **Clean separation of responsibilities.** Parent code is "do what the user asked"; child code is "telemetry". Future contributors maintaining either side don't accidentally bleed responsibilities across.
- **Reusable pattern.** Future fire-and-forget CLI side-channels (uptime pings, optional check-for-update notifications, the like) can adopt the same `fork()`-detached-IPC shape. The pattern is not telemetry-specific.

### Trade-offs

- **Process spawn cost is real, just invisible.** Spawning a child is not free (~30–80ms on Node). Spawning at command start makes it parallel with the parent's work, so the user doesn't perceive it, but the cost is still paid in CPU and memory. For a CLI invocation that itself runs for hundreds of milliseconds or more, this is noise. For invocations under the spawn-cost threshold (the genuinely-instant `--version` style), the absolute cost is small but the *relative* cost is high. Accepted because the alternative (in-process fire-and-forget) loses these events outright, which is worse.
- **No outcome data in Phase 1 events.** Spawning at command start precludes including success/failure/duration in the payload. This is by design — outcome data belongs to crash/error reporting, which has different isolation needs and is Phase 2.
- **Test runs must be wired to short-circuit.** A test suite that runs the CLI hundreds of times in a tight loop and forgets to disable telemetry will spawn hundreds of children. Mitigated by the firm requirement that tests set `PRISMA_NEXT_DISABLE_TELEMETRY=1` at harness setup; enforced by the test harness itself (plan-phase).
- **Debugging the sender script is mildly awkward.** Child `stdio` is ignored from the parent's perspective. A contributor debugging the sender needs to either run it directly with arranged stdin or temporarily edit the spawn call to surface stdio. Acceptable cost for the runtime isolation it provides.
- **Same-runtime constraint locks the sender to whatever the parent runs on.** A Bun-running parent forks Bun; a Node-running parent forks Node. The sender script must be runtime-compatible with all three (Node, Bun, Deno). In practice the sender does so little — IPC receive, fs read, fetch, exit — that runtime compatibility is unlikely to bite, but it's a constraint to keep in mind for future sender enhancements.

### Non-goals

- **Phase 1 does not implement crash/error reporting.** The detached-subprocess pattern is wrong for crash reporting — crash reporting needs synchronous-flush-before-exit (capture the stack, send before the process dies), which is the opposite of fire-and-forget. Phase 2 will use a different pattern, likely a synchronous flush in an `uncaughtException` handler with its own narrow timeout. This ADR does not constrain that design.
- **No event buffering.** Failed sends are lost. The spec accepts bounded loss; an on-disk queue would be a whole second system (corruption, growth, locks) for negligible benefit at the volume and precision we care about.
- **No reuse of an existing daemon / persistent process.** Some CLI tools amortise spawn cost by maintaining a background daemon that receives events from many invocations. Rejected for Prisma Next — a persistent process is a much larger surface (lifecycle, restarts, permissions, port allocation) than the design problem warrants.
- **No serialised cross-invocation state in the child.** Each child invocation is independent; the child does not read prior children's state, does not coordinate with siblings, does not aggregate. Each invocation is one fork, one send, one exit.

## Alternatives considered

- **In-process synchronous send with timeout.** Adds user-perceived latency to every CLI invocation. Rejected.
- **In-process fire-and-forget via `unref()`.** The conventional pattern; subtly violates the isolation contract on instant-exit commands due to event-loop drain semantics. Rejected.
- **Persistent background daemon receiving events from many invocations.** Larger lifecycle surface than the problem warrants. Rejected.
- **On-disk buffer with flush on next invocation.** Forbidden by the spec's NFR6. Rejected.
- **Manual `spawn(process.execPath, [senderPath])` instead of `fork()`.** Works, but the `argv` arrangement is brittle across Node / Bun / Deno; `fork()` encapsulates the correct shape. Rejected on simplicity grounds.
- **Spawn at command exit rather than command start.** Conventional, but adds user-perceived spawn cost and loses crash-time events. Rejected.

## Pattern reuse

The `fork(senderPath, [], { detached: true, stdio: [...], }); send; disconnect; unref` shape is a general-purpose primitive for **CLI side-channels that must not affect CLI behaviour**. Examples of future features that could adopt it directly:

- Optional check-for-update notifications.
- Uptime/heartbeat pings for a long-running CLI command.
- Anonymous performance traces shipped to an internal observability surface.

Features with different isolation needs (anything that needs synchronous flush before exit, anything that needs to influence the parent's exit code, anything that needs to display output to the user) should not reuse this pattern unmodified — they belong to a different category and should design their own contract.
