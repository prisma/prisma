# ADR 256 — Project-owned language-server file watching

**Status:** Accepted
**Date:** 2026-09-30

## Context

Schema diagnostics must change when another process edits a project member, even if no schema file is open in the editor. Checking disk metadata when an editor request reads a file cannot provide that behavior: without an editor request, the check never runs. Filesystem notifications therefore drive membership and content invalidation.

For example, a loaded project can configure `schemas/**/*.prisma` before the `schemas` directory exists:

```text
app/
  prisma.config.ts

external creation:
app/
  prisma.config.ts
  schemas/
    nested/
      user.prisma
```

The server observes a safe existing ancestor, discovers the new file through the configured input expansion, and reports diagnostics if its text carries `// use prisma-8`. Removing the file or its directory clears its previous report. No subsequent editor operation is required for push diagnostics. Pull clients receive a refresh request when supported and obtain updated reports on their next pull.

## Decision

A stable, concrete `Project` owns its watching lifecycle. `ProjectRegistry` discovers and routes projects; it does not own a separate watcher service hierarchy. Each project permanently observes its config directory through a shallow Chokidar 5 subscription. For schema notifications it selects compatible, successfully registered client notifications or internal Chokidar subscriptions. There is no third stat-on-read freshness mechanism or application-owned polling loop. Library-internal polling is permitted.

The design follows four rules:

1. **Notifications drive disk freshness.** Immutable disk snapshots remain cached until explicit invalidation. Cache misses read normally; they are not a freshness fallback for already cached files.
2. **Editor buffers are authoritative.** Disk invalidation, readiness reconciliation, and reload never replace an unsaved overlay with disk text.
3. **Watching does not define membership.** Events trigger the existing `resolveSchemaInputs`/`expandContractInputs` path and the schema directive check. Watching a candidate does not make it a member.
4. **Watching failures do not disable editing.** Loading, analysis, and editor operations continue; warnings explain that external changes may be missed until project reload or server restart.

## Backend selection and startup

Client watching requires dynamic registration support and input patterns that the client watcher can safely represent: simple ASCII paths with ordinary `*`, `?`, or whole-segment `**` wildcards. Extended or uncertain syntax uses internal watching instead. The registration result must distinguish rejection from a successful void response even through the connection's disconnect guards.

Failure or absence of a registration handle selects internal watching. Registration has no deadline: an unanswered request may leave schema updates unavailable indefinitely, but never blocks loading, editor features, or disposal. A successful superseded registration is disposed rather than replacing the current backend. A successful compatible client registration does not retain a duplicate internal schema watcher.

Initial loading does not wait for either backend. When internal subscriptions become ready, the project evicts its disk snapshots and reconciles membership once. Successful client registration also schedules reconciliation. This accounts for text cached before notifications became available, without producing a diagnostic sweep for every file discovered during Chokidar's initial scan.

## Directory coverage and limits

Chokidar receives literal directories, not input globs. Positive patterns contribute their static directory prefix; literal files contribute their containing directory. Missing roots use their nearest safe existing ancestor, and equivalent or nested roots within one project are deduplicated. Consequently empty globs and future subdirectories are covered without enumerating only the files present at startup. Inputs outside the config directory remain supported when their roots are safe.

The owning config's directory has its own permanent shallow subscription to survive atomic replacement. It remains subscribed even when schema roots overlap it, during config loading, and when client registration is pending. Internal events retain their owning project identity, including events for deleted files and inputs outside the config directory.

Coverage is deliberately conservative:

- Recursive watching of a filesystem root or UNC share root is refused.
- Dynamic patterns containing parent traversal are refused instead of deriving an unsafe root.
- Subscriptions use `followSymlinks: false`. There is no ancestor-by-ancestor symlink validation or per-link warning tracking. Input expansion can still read linked files; observation of changes to symlink targets is best-effort.
- Internal watching covers already discovered projects and their owning config, not workspace-wide discovery of new configs or imported config dependencies.
- A client that successfully registers but silently loses notifications is not detected.

Filesystem metadata is used to choose safe existing watch roots, never to revalidate cached document text on reads.

## Events, reloads, and shutdown

Client and internal events enter the same per-project update path. A 100 ms trailing debounce coalesces notification bursts for analysis, resetting after each notification while no batch is running. This delay does not guarantee completed writes and is independent of Chokidar's private suppression timing. The batch invalidates every project disk snapshot and corresponding analysis artifact, including candidate files without the directive, then reloads configuration or expands membership against current text. It publishes or clears push reports, or requests a pull refresh. Open overlays remain authoritative. Only refresh-needed and config-reload-needed flags are retained, not a set of notification paths. Directory deletion and atomic saves are interpreted from the filesystem state observed by the batch, not as a requirement to publish every intermediate state. Events received during asynchronous work are queued; another debounced pass is scheduled when that work completes.

Membership sequences and resolved configuration identity reject stale asynchronous analysis. A separate registration-attempt identity rejects superseded client registration results. Config events compare canonical filesystem identities, including Windows drive and UNC paths. Config reload explicitly discards project disk snapshots. Failed reloads can retain the last-good configuration and its analysis.

Config observation remains uninterrupted during loading. Ordinary reloads with unchanged inputs keep their schema subscriptions, and failed loads leave subscriptions unchanged. Only successful changed-input loads update roots. Internal updates and disposal are serialized. When roots change, the old schema subscription closes before a replacement starts; a gap in schema observations is accepted. There are no retained generations or replacement-readiness protocol. Chokidar `unwatch(parent)` marks descendants ignored, so adding a child does not reliably restore coverage; replacing only the schema subscription avoids that behavior. Real filesystem tests exercise repeated parent-to-child and child-to-parent changes.

Closing the last editor document leaves the project and its watching active. Server shutdown and asynchronous disposal cancel queued batches, reject subsequent callbacks and late registration results, and await serialized internal updates and Chokidar closures. They do not await client registration responses.

## Failure behavior and consequences

Internal initialization and active-watcher failures are logged. Working subscriptions are kept where possible, but a warning does not promise complete external freshness. Missed changes can remain cached until an explicit project/config reload or server restart. Unchanged-input reloads do not retry setup; a server restart can be required to restore notifications. Reload evicts cached disk content while preserving overlays.

Chokidar uses native watching by default, with `awaitWriteFinish` disabled. Library-internal polling, including environment overrides, is permitted. Watcher failures never select an application-owned stat fallback or suspend project analysis.

This choice trades guaranteed detection on unsupported filesystems for continued editing and a clear recovery action. Safe ancestor watching can cover more paths than the input glob matches; the existing membership resolver remains authoritative. Whole-project invalidation trades additional disk I/O for simpler batching. The separate shallow config subscription avoids watcher replacement during loading. Schema root changes accept an observation gap rather than coordinating replacement readiness, and unanswered client registration accepts indefinite loss of schema updates rather than adding timeout and cancellation state.

Diagnostic delivery remains exactly two modes: pull with related-document support, or push for every other client. The watching backend does not change that negotiation. Ownership of diagnostics for files shared by multiple projects is a separate concern and is unchanged.

## Alternatives considered

- **Stat-on-read revalidation:** cannot update a never-opened member without an editor request and would create a third freshness mechanism.
- **Application-owned polling after watcher failure:** adds a separate freshness mechanism and obscures the explicit failure/recovery policy. This does not prohibit polling within Chokidar.
- **Block analysis until watching succeeds:** makes editor operations unavailable because of notification infrastructure failures.
- **Watch only initially expanded files:** misses empty globs, future directories, and replacement membership.
- **Replace all subscriptions on every reload:** needs additional state to retain config observation during asynchronous loading. Stable config observation and changed-input-only schema updates avoid it.
- **Path-specific invalidation:** saves disk I/O but requires retaining event paths and distinguishing directory invalidation from startup reconciliation.
- **Registration deadlines:** bound notification unavailability but require timeout, cancellation, and late-result coordination. Analysis and disposal already proceed without awaiting registration.

## References

- [Language-server README](../../../packages/1-framework/3-tooling/language-server/README.md) — current membership, diagnostic delivery, and ownership reference.
- [Real filesystem/protocol tests](../../../packages/1-framework/3-tooling/language-server/test/server.internal-watcher.test.ts) — unopened members, empty globs, creation/deletion, config-input replacement, startup reconciliation, and shutdown.
- [Config changes during asynchronous loading](../../../packages/1-framework/3-tooling/language-server/test/project.config-watch.test.ts) — real atomic replacements across consecutive paused loads.
- [Deterministic lifecycle tests](../../../packages/1-framework/3-tooling/language-server/test/server.watch-cache.test.ts) — backend selection, registration outcomes, nonfatal failures, overlays, stable subscriptions, registration attempts, batching, and disposal.
