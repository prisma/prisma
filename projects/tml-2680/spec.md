# Summary

Replace the current `RuntimeVerifyOptions = { mode; requireMarker }` object on the SQL runtime API with a forward-compatible string-or-false union `verifyMarker?: 'onFirstUse' | false`, and change the runtime's response to detected contract-marker drift from "throw on every query" to "log a structured warning once per runtime."

Marker verification stops being an execution gate and becomes a diagnostic signal. Operators see drift in their logs; the runtime keeps serving traffic. The narrow class of failures the marker check catches that the SQL layer doesn't (codec-incompatible enum additions, silent type coercions during deploy-skew windows) is preserved, but its operational hazard (taking down an app the moment a migration lands) is removed.

Linear: [TML-2680](https://linear.app/prisma-company/issue/TML-2680/simplify-verify-api-replace-requiremarker-with-verify-false-to-disable).

# Description

## Problem

Two coupled flaws in today's `RuntimeVerifyOptions` API:

1. **`requireMarker` is an internal edge case that leaked into the public surface.** It only controls what happens when the marker row is *absent* (uninitialised DB) — a state users have no informed opinion about. It came out of a debugging exercise, not a user-facing concern.
2. **The runtime's only response to drift is `throw 'CONTRACT.MARKER_MISMATCH'` on every query.** Any contract change whose migration lands will immediately take down all in-flight app instances — even when those instances could keep serving traffic safely. There is no zero-downtime deploy path.

The runtime today reads the marker on first execute (in `streamRows`) via `verifyMarker()`, compares `storageHash` and `profileHash` against the contract, and throws on mismatch. The `requireMarker` flag only gates the absent-marker branch.

## Users and context

Two user populations are affected by the response change:

- **Production operators** running rolling deploys. Today, the moment a migration lands, all old-contract pods start throwing on every query — even for queries that touch only contract-compatible surfaces. The redesigned behaviour lets old pods keep serving until they roll out; operators see the divergence in their log stream rather than as a service outage.
- **Local / CI users** running against a freshly migrated DB. Today, this scenario rarely triggers because the runtime is signed with the new contract hash. Under the redesigned shape, this remains the case — the diagnostic only fires on actual drift.

## Surface and scope

The change lives in the SQL runtime layer, its three convenience-wrapper extensions, and any downstream workspace consumer that constructs runtimes through the renamed API.

### Owning packages

- `packages/2-sql/5-runtime/src/runtime-spi.ts` — owner of `RuntimeVerifyOptions`.
- `packages/2-sql/5-runtime/src/sql-runtime.ts` — the runtime implementation, including `verifyMarker()`, the constructor's mode-handling, and `streamRows`' verification call sites.
- `packages/2-sql/5-runtime/src/exports/index.ts` — public re-exports.
- `packages/3-extensions/sqlite/src/runtime/sqlite.ts`, `packages/3-extensions/postgres/src/runtime/postgres.ts`, `packages/3-extensions/postgres/src/runtime/postgres-serverless.ts` — convenience wrappers.

### In-package tests

- Tests under `packages/2-sql/5-runtime/test/` (~10 files reference the old shape; one — `marker-verification.test.ts` — pins behaviour and needs re-targeting at log emission).
- `packages/3-extensions/postgres/test/postgres-serverless.test.ts` — also references the old shape.

### Downstream consumers (must be migrated in lockstep)

The rename is breaking; every workspace package that constructs a runtime or imports `RuntimeVerifyOptions` must be migrated in the same commit, or workspace-wide typecheck breaks. Concretely:

- `test/integration/test/utils.ts` — shared helper exposing a `verify` option on `CreateTestRuntimeOptions`; threads into `createRuntime`. Touched transitively by most integration tests.
- `test/integration/test/runtime.verify-marker.missing-table.integration.test.ts` — pins old `requireMarker: true` throws-`CONTRACT.MARKER_MISSING` semantics. **Needs semantic re-targeting**, not just literal replacement: assertions flip from "rejects with `CONTRACT.MARKER_MISSING`" to "the log handler receives a structured `warn` payload with `code: 'CONTRACT.MARKER_MISSING'` and the query proceeds." The test stays — it's the integration-level coverage of the missing-table branch against a real DB and is complementary to the unit-level coverage in `marker-verification.test.ts`.
- `test/integration/test/value-objects/value-objects.e2e.test.ts`, `test/integration/test/sql-orm-client/runtime-helpers.ts`, `test/integration/test/sql-builder/setup.ts`, `test/integration/test/rewriting-middleware.integration.test.ts`, `test/integration/test/cross-package/middleware-cache.test.ts` — literal-replacement sites.
- `test/e2e/framework/test/sqlite/runtime.verify-marker.missing-table.test.ts` — imports `RuntimeVerifyOptions` (must drop), pins the old throw behaviour (same semantic re-targeting as the integration counterpart). Stays; complementary at the e2e layer.
- `test/e2e/framework/test/sqlite/utils.ts` — literal replacement.
- `examples/prisma-8-demo/src/prisma-no-emit/runtime.ts` — **production-shaped example code**. Replacing the literal is high-leverage: this is what readers learning the framework see.
- `examples/prisma-8-demo/test/sql-dsl.integration.test.ts`, `examples/prisma-8-demo/test/repositories.integration.test.ts` — literal replacement.

### Docs

- `packages/2-sql/5-runtime/README.md` — example snippet uses the old API; symbol table entry references `RuntimeVerifyOptions`.
- `docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md` — runtime API snippet uses the old shape.
- ADR 021 / 042 (Contract Marker Storage / Evolution) — possibly amended with a Decisions section noting the read-side response shift.
- Per-package CHANGELOGs (`@internal/sql-runtime`, `@internal/sqlite`, `@internal/postgres`) — breaking-change note with migration snippet.

# Requirements

## Functional requirements

### API shape

- Remove `RuntimeVerifyOptions` entirely. The `RuntimeOptions.verify` and `CreateRuntimeOptions.verify` fields are replaced by `verifyMarker?: VerifyMarkerOption`.
- Introduce a public, forward-compatible union:

  ```ts
  // runtime-spi.ts
  export type VerifyMarkerOption = 'onFirstUse' | false;
  ```

  The string-or-false shape (rather than `boolean`) is deliberate: future modes such as `'startup'` (eager check inside the wrapper `connect()` step) can be added as additive union members without an API break. `true` is **not** permitted — there is no generic "yes" value; modes are always named.

- Default value when the field is omitted: `'onFirstUse'`. Documented in the type's JSDoc; not encoded as a runtime fallback that hides the omitted case from typecheckers.

- Convenience wrappers (`sqlite`, `postgres`, `postgres-serverless`) accept and thread `verifyMarker` through to `createRuntime`. They no longer default to `{ mode: 'onFirstUse', requireMarker: false }` — they pass the user-supplied value (or `'onFirstUse'`) to `createRuntime`'s own default.

### Behaviour

- **`verifyMarker: 'onFirstUse'` (default).** The marker reader is invoked once per runtime, on the first `execute()` call. On any non-success outcome — hash mismatch, absent row, missing table — the runtime emits a structured log warning through its existing `Log` interface and proceeds with the query. Subsequent queries on the same runtime do not re-invoke the marker reader.

- **`verifyMarker: false`.** The marker reader is never invoked. No log line is emitted. Zero round-trips to the DB for verification.

- **Hash equality.** Unchanged: when the marker is present and both `storageHash` and `profileHash` match the contract, no log is emitted; the runtime is silently verified.

- **One-shot semantics.** A given runtime emits at most one verification log line in its lifetime, regardless of how many queries pass through it. The existing `verified` / `startupVerified` flag pattern in `SqlRuntimeImpl` serves this purpose and is preserved (collapsed into a single flag, since there's only one mode now that can fire).

### Log payload

The verification log is emitted at `warn` level (through `RuntimeOptions.log.warn`) and carries a structured payload:

```ts
{
  code: 'CONTRACT.MARKER_MISMATCH' | 'CONTRACT.MARKER_MISSING',
  scope: 'marker-verification',
  expected: { storageHash: string; profileHash: string | null },
  actual: { storageHash: string; profileHash: string | null } | null,  // null when the marker row is absent
  message: string,  // human-readable summary
}
```

- `code: 'CONTRACT.MARKER_MISSING'` fires for `kind: 'absent'` and `kind: 'no-table'`.
- `code: 'CONTRACT.MARKER_MISMATCH'` fires for hash divergence on a present marker.

The string codes are inline identifiers — there is no central enum in the framework errors module to delete; `runtimeError(code, ...)` accepts a free-form `code: string`, so the only producers of these particular codes are the two `runtimeError('CONTRACT.MARKER_*', ...)` call sites inside `SqlRuntimeImpl.verifyMarker()`. After this change, no producer remains; the strings live on only as stable tags in the new log payload. Callers that previously caught `CONTRACT.MARKER_*` runtime errors must migrate to log scraping or to the explicit-verification surface (see below).

**Related surface, intentionally untouched: the `db-verify` CLI command** (`packages/1-framework/3-tooling/cli/src/commands/db-verify.ts`) and the underlying control-instance verification flow (`packages/2-sql/9-family/src/core/control-instance.ts`, `packages/2-mongo-family/9-family/src/core/control-instance.ts`) use a **distinct** identifier set: `VERIFY_CODE_MARKER_MISSING = 'PN-RUN-3001'`, `VERIFY_CODE_HASH_MISMATCH`, `VERIFY_CODE_TARGET_MISMATCH` (defined in `packages/1-framework/1-core/framework-components/src/control/control-result-types.ts`). That flow is the operator-invoked "verify the DB now" path; it returns a structured failure result and is the existing strict-mode surface this slice does **not** need to duplicate. The `PN-RUN-*` codes and the CLI command are out of scope for this change.

### Removed surfaces

- `RuntimeVerifyOptions` (interface).
- `RuntimeOptions.verify` / `CreateRuntimeOptions.verify` (renamed to `verifyMarker`).
- `requireMarker` (field on the removed interface; no replacement).
- `runtimeError('CONTRACT.MARKER_MISSING', …)` and `runtimeError('CONTRACT.MARKER_MISMATCH', …)` thrower call sites in `SqlRuntimeImpl.verifyMarker()`. The string codes themselves stay in the codebase (in log payloads); only the throwers go.

## Non-goals

- **Telemetry surface for marker drift.** No new telemetry event, hook, or callback is added in this slice. Operators rely on log scraping.
- **Strict / throw mode.** No opt-in "throw on mismatch" mode is added. Users who want fail-fast in CI use `verifyMarker: false` and rely on per-query codec errors as the failure surface, or wait for a follow-up.
- **Eager marker check at connect().** The check stays lazy on first execute. Wrappers' `connect()` is not wired into verification in this slice. A future `'startup'` mode can add this; the union type is open.
- **Dual-signature marker writes.** The proper zero-downtime primitive (migrations writing both the previous and new contract hashes during a deploy window, runtimes accepting either) is migration-emission work and is tracked separately.
- **Always-mode (`mode: 'always'`) preservation.** The "re-check every query" mode is dropped — in a log-only world it produces log spam without adding signal. Not in the forward-compat union.

# Risks

- **Breaking API change.** `verify: { mode, requireMarker }` → `verifyMarker: 'onFirstUse' | false`. `RuntimeVerifyOptions` is removed. The package is pre-1.0; breaking is allowed and must be flagged in the changelog with a migration snippet.
- **Behaviour change for callers catching `CONTRACT.MARKER_MISMATCH`.** Any code that catches this error to detect deploy-skew will stop seeing throws. Mitigation: explicit changelog note; README update; mention in the migration snippet that the new way to observe drift is via the log handler.
- **Fresh-DB first-connect log noise.** A brand-new DB without a marker row will log on the first connect (because the marker reader returns `kind: 'no-table'`). Acceptable: real users always migrate before running queries; the log line is honest about the state.
- **Forward-compat union encourages later additions.** Adding `'startup'` later means wiring marker-read into the wrappers' `connect()`. The type leaves room but does not pre-commit to the implementation. We document this in the type's JSDoc so future-us doesn't have to re-derive why the union shape exists.

# Acceptance

A new contributor reading the public surface sees a single boolean-shaped option `verifyMarker?: 'onFirstUse' | false` on the runtime / wrapper APIs, with the absence of the field meaning "lazy verification on first execute, log on drift, never throw." `requireMarker`, `mode`, and `RuntimeVerifyOptions` are gone. The runtime's first-execute marker read produces a `warn`-level structured log on any non-success outcome, and the query proceeds. `verifyMarker: false` short-circuits the marker reader entirely.

The README example, the test suite, and the three convenience wrappers all consistently use the new surface. The changelog calls out the breaking change with a one-line migration recipe.
