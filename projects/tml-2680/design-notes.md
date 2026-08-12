# Design notes — marker verification API

This document captures the design discussion that shaped the slice spec. It exists separately because the **reasoning** behind the API design is more durable than the API itself, and won't survive in the PR description after merge. Future work that touches the marker-verification surface should read this first.

The discussion was conducted via the `drive-discussion` skill in two persona passes: `principal-engineer` (operational shape: what failure modes is the API actually for?) followed by `architect` (naming and type shape: what name reads cold? what surface earns its keep?).

## Refined topic

We entered the discussion with the [TML-2680](https://linear.app/prisma-company/issue/TML-2680/simplify-verify-api-replace-requiremarker-with-verify-false-to-disable) framing: *"replace `requireMarker` with `verify: false` so users can opt out of marker verification."* The discussion reframed the question to: **what is marker verification actually for, and what should the runtime do when it detects drift?**

The settled answer reshapes the API well past what the ticket proposed.

## Decisions

### D1 — Remove `requireMarker` outright

`requireMarker` is a debugging artifact, not a user-facing knob. It only gates the absent-marker branch (`kind: 'absent'` / `kind: 'no-table'`) of `verifyMarker()`, and users have no informed opinion about "what should happen when the marker table is missing" — it's an internal edge case. Empty-marker isn't structurally different from hash-mismatch either; both indicate "this DB has not been migrated by this contract." Same response in the new design.

### D2 — Marker verification becomes a diagnostic, not an execution gate

On mismatch (or absent marker), the runtime emits a structured `warn`-level log line *once per runtime* through its existing `Log` interface, and continues serving queries. It never throws.

The argument that drove this:

- The only response the runtime had to drift was `throw 'CONTRACT.MARKER_MISMATCH'` on every query.
- That means any migration that ships a contract change takes down all in-flight app instances the moment the migration lands. Zero-downtime deploys are impossible by construction.
- Most contract changes are SQL-compatible (additive columns, new tables); old-contract pods can keep serving safely. Throwing universally is an operational over-reaction.
- The narrow class of changes the marker check catches that the SQL layer doesn't — codec-incompatible enum additions, silent type coercions like `int4` → `bigint`, default-value changes that shift decoding — only affects queries that touch the divergent surface. Other queries are fine.
- The right shape: keep the diagnostic, change the response to "log, don't crash."

### D3 — Collapse the entire `mode` axis to a string-or-false union

`RuntimeVerifyOptions` (`{ mode: 'onFirstUse' | 'startup' | 'always'; requireMarker: boolean }`) is removed. Replaced by:

```ts
export type VerifyMarkerOption = 'onFirstUse' | false;
```

The discriminator collapse happened because:

- `'startup'` and `'onFirstUse'` were already functionally identical in the implementation — both fired the marker read inside `streamRows`, i.e. on the **first execute**, not at runtime construction. The `'startup'` name was lying.
- `'always'` (re-check every query) is incompatible with a log-only world — it produces log spam without adding signal.
- A `boolean` shape (`true` / `false`) was considered but rejected: it leaves no room for *named* modes to be added later (e.g. a future `'startup'` mode that wires marker-read into the wrappers' `connect()` step for true eager fail-fast). The string-or-false union is forward-compatible by additive union growth.
- `true` is intentionally **not** permitted in the type. There is no generic "yes" value; modes are always named. Adding `true` later would also be additive and non-breaking, but disallowing it now keeps the API tight and forces named modes.

### D4 — Name the option `verifyMarker`, not `verify` / `verifyContract` / `verifyDb`

The architect-lens cold-read test:

- **`verify`** alone: fails. A fresh contributor seeing `verify: 'onFirstUse'` asks "verify what?" — the noun is missing.
- **`verifyContract`**: misleads. Implies the contract is being self-validated (checking the contract's own structural integrity, perhaps). What actually happens is a hash comparison between the runtime's contract and the marker row in the DB. The contract isn't being verified; *the marker* is being compared against the contract.
- **`verifyDb` / `verifyDB`**: misleads worst. Implies live-schema inspection, connectivity check, or health probe. None of those happen — we read one row from one tracking table.
- **`verifyMarker`**: passes. The action is literally "verify the marker." It aligns with the existing user-facing vocabulary (`MarkerReadResult`, the `CONTRACT.MARKER_MISMATCH` log code, the `prisma_contract.marker` table that surfaces in DB introspection, ADRs 021 / 042).

### D5 — Default to `'onFirstUse'`, not `false`

Default-on means the diagnostic exists by default. Teams who never thought about it get the warning when something goes wrong — exactly the teams who'd most benefit. Default-off would make a useful signal invisible to anyone who didn't go looking.

Teams who want to silence during a known-skewed deploy window do so consciously by passing `verifyMarker: false`. That's the rare, intentional opt-out — not the default state.

## Assumptions

These assumptions underpin the design. If any of them turn out to be wrong, the design needs to be re-opened — not amended silently.

- **A1** — When the marker table itself is missing (`kind: 'no-table'`), the marker reader returns the tagged result and the runtime logs and continues. Real users always migrate before running queries; a fresh-DB first-connect log line is acceptable.
- **A2** — Structured logging through the runtime's existing `Log` interface is sufficient signal for operators. No telemetry / hook / callback surface is needed in this slice.
- **A3** — Lazy-on-first-execute is acceptable for substantially all apps. First query happens within a second of startup for any non-toy app. Cron-like workers with hour-long sleep intervals between first-startup and first-query are accepted as a narrow case that can issue a no-op query manually if they want eager fail-fast.
- **A4** — "Marker" is sufficiently established as user-facing vocabulary (error codes, table name, README references, ADRs) that we are not introducing a new term.
- **A5** — A one-shot log line per runtime is acceptable steady-state noise. When there's no drift, no log fires; this is a per-runtime-lifetime cost, not a per-query cost.
- **A6** — The narrow class of failures the marker check catches (codec incompatibilities, silent type coercions) is real and hard enough to root-cause from per-query errors weeks later that the check earns its modest implementation cost.
- **A7** — `MarkerReader.readMarker(...)` exceptions are *not* part of the one-shot guarantee. If the reader itself throws (driver-level failure, adapter-level error), the exception propagates to the caller of `execute()` and the `verified` flag is **not** set; the next query will re-attempt the read. The one-shot guarantee covers only the *successful-but-non-matching* outcomes (mismatch, absent, no-table). This is consistent with how the runtime treats any other transient driver failure on first execute. If a future change wants reader exceptions to also count as "verified" (e.g. to avoid log-spam under sustained DB outages), that's an explicit follow-up — not a silent amendment to A7.

## Alternatives considered and rejected

| Alternative | Rejection reason |
|---|---|
| **Ticket Option A**: keep object, add `mode: 'off'` | The whole `mode` axis was collapsed (D3); preserving the object shape would be vestigial. |
| **Ticket Option B**: `verify: false` shorthand alongside object form | Same — the union *is* the final shape, not a shorthand for a richer form. |
| **`verifyMarker?: boolean`** (true / false) | Rejected in favour of the string-or-false union (D3) to leave additive room for `'startup'` and future named modes without an API break. |
| **Three-mode union `'startup' \| 'onFirstUse' \| false`** today | `'startup'` and `'onFirstUse'` are not structurally distinct under current code (both fire on first execute). Shipping both would be a lying typology. `'startup'` can be added later when we wire marker-read into wrappers' `connect()`. |
| **Eager marker check in wrapper `connect()`** as part of this slice | Adds plumbing in three wrappers, a connect-time round-trip, and a new "what if the marker read itself fails" failure path — for the benefit of "the warning appears in startup logs ~1s sooner." Not worth it; deferred to a future `'startup'` mode if demand surfaces. |
| **Keep `mode: 'always'`** | In log-only world: spams logs without signal. Dropped. |
| **`verifyDb`** | Implies live-schema inspection that doesn't happen (D4). |
| **`verifyContract`** | Implies contract self-validation; the contract is being compared against the marker, not validated (D4). |
| **Drop marker verification entirely** | The narrow class of catches (A6) is real and hard to root-cause from per-query decode errors weeks after the fact. The check earns its keep at modest cost; the right move is to soften the response, not remove the diagnostic. |
| **Telemetry / hook / per-query strict-mode opt-in** | Deferred. Slice stays narrow. Strict mode for CI is a possible follow-up; today's escape is `verifyMarker: false`. |
| **Dual-signature marker write** (migration writes both the previous and new contract hashes during a deploy window; runtime accepts either) | The proper zero-downtime primitive, but it's a *migration-emission* change, not a runtime API change. Tracked separately. This slice unblocks the deploy window by making the runtime non-fatal; dual-signature would let migrations explicitly allow the window. |

## Open questions accepted into the slice

- Exact log-payload shape (field names, JSON schema). The spec pins a proposal; the implementing PR locks in the final structure.
- Whether `CONTRACT.MARKER_MISSING` / `CONTRACT.MARKER_MISMATCH` survive as code identifiers used in the log payload (the spec says yes — they become stable string tags rather than thrown error codes). The framework errors module entries for these codes are deleted because nothing throws them anymore.

## Persona-pass cross-pollinations

The PE → architect ordering was load-bearing. The architect-lens typology pressure (`'startup'` doesn't earn its keep because it isn't structurally distinct from `'onFirstUse'`) only made sense after the PE lens had reduced the response from "throw" to "log." Under a throwing system, eager-fail-at-startup vs. lazy-fail-on-first-use is a real operational distinction worth a knob. Under a logging system, the timing distinction becomes cosmetic and the knob collapses.

The architect's cold-read probe on `verify` then settled the name (D4) — but only once the underlying shape (D3) was locked in. A union called `verify: 'onFirstUse' | false` reads worse than `verifyMarker: 'onFirstUse' | false` because the noun is missing, but neither read makes sense until you know the type's a string-or-false rather than an object.

## Related existing surface — explicit `db-verify` CLI

Pre-spec investigation (after the discussion closed but before dispatch) surfaced that the codebase already has an **explicit operator-invoked verification path** distinct from the runtime's silent read-path:

- `packages/1-framework/3-tooling/cli/src/commands/db-verify.ts` — CLI command `db-verify` calling `verifyDatabase(...)`.
- `packages/1-framework/1-core/framework-components/src/control/control-result-types.ts` — defines codes `VERIFY_CODE_MARKER_MISSING = 'PN-RUN-3001'`, `VERIFY_CODE_HASH_MISMATCH`, `VERIFY_CODE_TARGET_MISMATCH`.
- `packages/2-sql/9-family/src/core/control-instance.ts` and `packages/2-mongo-family/9-family/src/core/control-instance.ts` — emit those codes from the family-level verification flow.

This is the "operator asked for verification now, give a structured failure" path. It's strict by design — it returns a failure result the caller can react to.

Implication for this slice: **we don't need to add a strict / throw mode to the runtime API**. The CLI already serves the "I want fail-fast verification" use case. The runtime's job is the silent diagnostic; the CLI's job is the explicit verification. The two surfaces are complementary, not competing.

This means the "Optional strict / throw mode for CI" follow-up below is **demoted** — it's only worth doing if real demand surfaces for "fail-fast verification *inside* the runtime process," which the existing CLI surface already covers for ~all operational use cases.

## Follow-ups (separate tickets)

- **Thread `log` through the convenience wrappers.** Surfaced during the post-commit review: none of `sqlite`, `postgres`, `postgresServerless` accept or thread a `log` option through to `createRuntime`. The result is that operators using the convenience wrappers cannot observe the new marker-verification warnings — the warnings land on the runtime's default `Log` (effectively a noop). The slice's behaviour change ("log, don't throw") works as designed at the `createRuntime` layer, but is invisible to wrapper users. The slice does not introduce the gap (the wrappers never exposed `log`), but it does make the user-visible cost of the gap concrete. Recommended action: a separate ticket adding `log?: Log` to each wrapper's `*OptionsBase` interface and threading it via `ifDefined`. Three near-identical changes plus wrapper-level tests.
- **Dual-signature marker writes.** Migrations write both the previous and new contract hashes during a deploy window; runtime accepts either. The proper zero-downtime primitive; lives in the migration-emission layer.
- **Eager-at-`connect()` mode (`'startup'`).** Wire marker-read into the wrappers' `connect()` step so the warning appears in startup logs, before any traffic. Additive union member; no API break.
- **Telemetry surface for marker drift.** A dedicated telemetry event for the mismatch case, in addition to the log line.
- **(Demoted; only if demand surfaces.)** Optional strict / throw mode for the runtime API. Existing CLI `db-verify` covers the explicit-verification case; this would add an in-process equivalent. Additive union member if added.
