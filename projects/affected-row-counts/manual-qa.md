# Manual QA — TML-3166 (affected row counts)

> **Be the user.** Read the durable documentation as an application developer using count terminals and as an extension author implementing a driver or middleware.
>
> **Out of scope of this script.** Do not re-run the package, integration, e2e, typecheck, or lint suites. CI owns those automated obligations. Do not delete `projects/affected-row-counts/`.
>
> **Spec:** `projects/affected-row-counts/spec.md`
> **Plan:** `projects/affected-row-counts/plan.md`
> **PR:** not applicable; this is a close-out prerequisite dispatch.

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | --- | --- | --- | --- |
| 1 | Read the count-terminal journey | A consumer can find and reconcile shipped count behavior with target semantics | read-only | AC-1, AC-2, AC-4, AC-6 |
| 2 | Read the extension-author lifecycle | A driver or middleware author can implement the current SPI without stale hook or error vocabulary | read-only | AC-2, AC-3, AC-5 |
| 3 | Exploratory: bounded coherence pass | A fresh reader can spot remaining contradictions or broken references | read-only | (charter) |

> Scenarios 1 and 2 are **judgement** scenarios: the runner compares the docs against the shipped source and evaluates whether a fresh reader can complete the journey without guessing. Scenario 3 is an **exploratory** charter. Automated implementation and test obligations are deliberately marked N/A below.

## Pre-flight

1. Confirm the checkout is on the close-out branch and record `git rev-parse HEAD`.
2. Confirm `git status --short` before the read-through. The script itself must not modify tracked source or durable docs.
3. Read the spec's Project Definition of Done and the listed durable documents before evaluating any scenario.

## Scenario 1 — Read the count-terminal journey

**What you're proving from the user's seat:** An application developer can start at `updateAndCount` or `deleteAndCount`, understand that the returned number comes from the write, and learn the target-specific meaning of that number without confusing aggregate counts, row streams, or a pre-read fallback.

**Covers:** AC-1, AC-2, AC-4, AC-6

**Isolation:** `read-only`

**Oracle:** The shipped ORM implementation and tests: `packages/3-extensions/sql-orm-client/src/collection.ts`, `test/integration/test/sql-orm-client/update.test.ts`, `test/integration/test/sql-orm-client/delete.test.ts`, `test/integration/test/sql-orm-client/count-terminal-interleaving.test.ts`, `packages/2-mongo-family/5-query-builders/orm/src/collection.ts`, and the target drivers. The durable docs must describe one write-derived count and must not imply one universal matched-row definition.

**Preconditions:**

- The pre-flight checkout and clean-status checks completed.
- Read `scorecard/06-sql-orm-client.md`, `scorecard/07-mongodb-query-and-orm.md`, `docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md`, and `docs/architecture docs/subsystems/10. MongoDB Family.md`.

### Steps

1. Starting from the scorecard rows for `updateAndCount` and `deleteAndCount`, follow the evidence links into the tests and then into the collection implementation.
2. Trace the consumer path in prose: terminal → `RuntimeScope.execute()` → runtime statistics result → numeric terminal result.
3. Compare the documented semantics with the target implementation: Postgres `rowCount`, SQLite `StatementSync.run().changes`, and Mongo `modifiedCount` / `deletedCount`.
4. Read the SQL runtime example and Mongo terminal/execution sections as a fresh consumer. Note whether a reader can tell when to use `query()` versus `execute()`.

### What you should see

- The docs say count terminals issue the write and return the write's statistic, not a count derived from a preceding row query.
- Postgres no-op matches can count as matched rows; SQLite and Mongo are not described as having that same meaning.
- SQLite's `RETURNING` distinction directs row-producing statements to `query()`.
- Mongo update and delete count meanings are visible where Mongo users read about terminals and runtime execution.
- Scorecard evidence is explicit about integration-qualified ✅ versus shipped-but-not-yet-integration-qualified 🟡.

### Failure modes (anything matching these = a finding the runner will classify)

- A durable page still describes the old pre-`SELECT` count path or derives `affectedRows` from row length.
- A target's count definition is missing, contradictory, or presented as universal.
- A scorecard marks a target ✅ without qualifying integration evidence, or hides shipped support by leaving no evidence/note.
- The example sends row-producing work through `execute()` or makes statistics look like a lazy row stream.
- An evidence link is broken or points at a stale test name.

## Scenario 2 — Read the extension-author lifecycle

**What you're proving from the user's seat:** A driver author can implement the two-method `SqlQueryable` SPI and a middleware author can select the correct lifecycle and result shape without relying on the retired generic `intercept` contract, a fake operation discriminator, or stale `ADAPTER.PREPARE_FAILED` vocabulary.

**Covers:** AC-2, AC-3, AC-5

**Isolation:** `read-only`

**Oracle:** `packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts`, `packages/1-framework/1-core/framework-components/src/execution/runtime-middleware.ts`, `packages/1-framework/1-core/framework-components/src/execution/before-execute-chain.ts`, `packages/1-framework/1-core/framework-components/src/execution/run-with-middleware.ts`, ADR 210, ADR 215, and ADR 239.

**Preconditions:**

- The pre-flight checkout and clean-status checks completed.
- Scenario 1 is independent; no output from it is required.

### Steps

1. Read ADR 210's Driver SPI and stale-handle retry sections beside `driver-types.ts`.
2. Verify that `SqlQueryable.query()` is the row stream, `SqlQueryable.execute()` returns `{ affectedRows }`, and prepared-ness is the optional request handle rather than a separate driver method.
3. Read ADR 215 and the runtime middleware source from `beforeQuery` / `beforeExecute` through the matching interceptor and completion hook.
4. Check that query interception is `{ rows }`, execute interception is `{ stats }`, `onRow` is query-only, and no context/result carries an `operation` discriminator.
5. Follow ADR links and search the amended docs for `ADAPTER.PREPARE_FAILED` and stale ADR 027 references.

### What you should see

- The ADR and source show the same two-method driver surface and opaque lazy handle semantics.
- The lifecycle order is legible: shared SQL `beforeCompile`, operation-specific before hook before encoding, matching interceptor, matching driver terminal, and matching completion hook.
- The two interceptor result shapes cannot be confused by a reader.
- The current `DRIVER.PREPARE_FAILED` code points to ADR 239, and the amended architecture docs do not teach the abolished `ADAPTER` namespace or generic `intercept` hook.

### Failure modes (anything matching these = a finding the runner will classify)

- ADR 210, ADR 215, subsystem 4, and source disagree on method names, result shapes, or ordering.
- A reader is told that `beforeExecute` is skipped on an interception hit, or that it only runs on a driver path, without the corresponding operation-specific before-hook explanation.
- Middleware documentation suggests a generic `intercept` or an `operation` discriminator that source does not expose.
- A stale error namespace/reference remains in the amended durable docs.

## Scenario 3 — Exploratory: bounded coherence pass

**Charter:** Spend no more than 5 minutes scanning the amended ADRs, subsystem pages, scorecards, and their immediate source links as a fresh extension author. Probe one application count journey and one middleware/driver journey not already covered by the scripted steps. Record anything surprising, contradictory, hard to find, or visually confusing. Do not edit while exploring.

**Covers:** (no specific AC; charter)

**Isolation:** `read-only`

**Time budget:** 5 minutes

**Notes capture:** Record the exact file and heading for each observation. Distinguish a factual documentation finding from a follow-up suggestion about discoverability. If no finding appears, record the paths and journeys sampled.

## Scenarios deliberately not in this script

| AC | Why it is not a manual-QA scenario |
| --- | --- |
| Driver and runtime automated tests | CI and package test suites are the authoritative enforcement seam; re-running them manually adds no user judgement. |
| Exact one-statement and interleaving assertions | These are already automated integration obligations. The manual contribution is checking that durable docs lead a reader to the evidence and describe its meaning honestly. |
| Typecheck, build, lint, and link checker exit status | These are mechanical gates. Scenario 1 and Scenario 2 inspect the links and references as a reader instead of duplicating clean-tree CI. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| --- | --- |
| AC-1 | 1 |
| AC-2 | 1, 2 |
| AC-3 | 2 |
| AC-4 | 1 |
| AC-5 | 2 |
| AC-6 | 1 |
| Automated implementation/test obligations | CI; not manual-QA scope |
