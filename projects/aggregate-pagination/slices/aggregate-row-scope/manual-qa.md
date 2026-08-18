# Manual QA — aggregate-row-scope (root `.aggregate()` honours the chain's row scope)

> **Be the user.** You are an application developer who writes `db.orm.Post.orderBy(…).take(10).aggregate(…)` and expects a number that reflects those ten rows. Before this slice, you got a number reflecting *every* matching row — confidently, silently, with no signal. Your job here is to sit in that seat against a real database and a real emitted contract, and judge what the test suite structurally cannot.
>
> **Out of scope of this script.** Do not re-run the package test suite, the integration suite, `pnpm typecheck`, `pnpm lint`, or `fixtures:check`. CI runs all of them on every push and 326 integration tests already assert values on both targets. Re-running them here proves only that your machine matches CI. Do not inspect the baseline snapshot file — it is a CI mechanism, not a user observation.
>
> **Consumer audiences covered — both.** Per `drive/calibration/patterns.md § Consumer audiences`:
>
> - **End users** (the audience using prisma-next via `examples/`): scenarios 1, 2 and 6 drive `examples/prisma-8-demo` against its own emitted contract and a real Postgres — the published package surface, not test harnesses.
> - **Extension authors** (the audience consuming the framework's authoring substrate and export surface): scenarios 3 and 5 compose runtimes and contracts directly through `defineContract` and the framework's exported `Collection` surface, which is the substrate an extension author builds on. Scenario 3 in particular exercises the capability-gating contract — an extension author shipping a target that does not report `postgres.distinctOn` depends on that gate behaving exactly as the sql-builder lane's does.
>
> Scenario 4 (TSDoc) serves both: it is the discovery surface for either audience.
>
> **Spec:** `projects/aggregate-pagination/slices/aggregate-row-scope/spec.md`
> **Plan:** `projects/aggregate-pagination/slices/aggregate-row-scope/plan.md`
> **Project spec:** `projects/aggregate-pagination/spec.md`
> **PR:** _(fill at PR-open)_

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Read a paginated aggregate from the demo app | A developer using the published surface against a real emitted contract gets the scoped number, not the unscoped one | `workspace` | AC-4, AC-6 |
| 2 | Reduce over deduped rows and read the number **(judgement)** | `distinct()` + `orderBy` + `take` reduces over the ordered top-n *after* dedup, which is the case whose failure is a plausible-looking wrong answer | `workspace` | AC-6 |
| 3 | Ask SQLite for `distinctOn` and read the refusal **(negative control)** | The capability gate fires at compile time *and* runtime, with a diagnostic that tells a stranger what to do | `workspace` | AC-6 |
| 4 | Read the new TSDoc as a stranger would **(judgement)** | The behaviour change is discoverable in an editor by someone who never read this PR, and its example copies and runs | `read-only` | AC-8 |
| 5 | Page past the first rows on SQLite | `skip` without `take` returns an answer rather than a syntax error — the defect this slice predicted, confirmed, then fixed | `tmpdir` | AC-4 |
| 6 | Exploratory: probe combinations the script skipped | Surfaces unknown unknowns in clause combinations no scripted scenario enumerates | `workspace` | (no AC; charter) |

> Scenarios marked **(negative control)** plant a violation, observe the gate fire, then restore. Scenarios marked **(judgement)** require evaluation against an explicit oracle no test asserts. Scenario 6 is a time-boxed charter with no scripted steps.
>
> The **Isolation** column tells the runner how to schedule the scenario in parallel: `tmpdir` (own scratch dir), `workspace` (own `git worktree`), `read-only` (no isolation needed), `external` (network-bound).

## Pre-flight

1. `git -C <repo> status --porcelain` — record the baseline. The tree should carry only `projects/aggregate-pagination/` as untracked.
2. `pnpm build` — several dispatches in this slice hit stale `dist/` artifacts in this worktree (the CLI bin, `@prisma/orm-family-sql`, `@internal/postgres`, `@prisma/orm-postgres`, and stale generated CLI e2e fixture dirs). If any scenario fails with a module-resolution or `command not found` error, rebuild the named package before treating it as a finding.
3. Confirm the demo app exists: `ls examples/prisma-8-demo/src/orm-client/`.

## Scenario 1 — Read a paginated aggregate from the demo app

**What you're proving from the user's seat:** end-to-end developer-journey smoke. The integration suite drives the ORM through test harnesses and hand-built runtimes; this drives the *published package surface* against the demo's own emitted contract, which is what an actual user touches. It is also the re-enactment of the motivating defect: before this slice, this exact chain returned the unscoped number.

**Covers:** AC-4, AC-6

**Isolation:** `workspace`

**Oracle:** arithmetic you compute by hand from the seeded rows. Read the seed data first, decide what the top-N sum *should* be, write it down, then run the query. The oracle is your arithmetic, not the query's own output.

**Preconditions:**
- A Postgres the demo can reach (its usual local setup).
- The demo's contract is emitted and current.

### Steps

1. Read `examples/prisma-8-demo/src/orm-client/` to find the model with a numeric field and enough seeded rows to page through.
2. Note the seed values. Compute by hand: the sum of **all** rows' numeric field, and the sum of the **top 2 by that field descending**. Write both numbers down before running anything.
3. Add a script alongside the existing ones that runs the unscoped aggregate: `.aggregate((agg) => ({ total: agg.sum('<field>') }))`.
4. Run it. Record the number.
5. Change the chain to `.orderBy((m) => m.<field>.desc()).take(2).aggregate((agg) => ({ total: agg.sum('<field>') }))`.
6. Run it. Record the number.

### What you should see

- Step 4's number equals your hand-computed **full** sum.
- Step 6's number equals your hand-computed **top-2** sum, and **differs from step 4's**. If the two numbers are equal, either your seed data cannot distinguish the cases (fix the data and re-run) or the row scope is not being applied — the latter is a finding.
- The emitted SQL (log it if the demo makes that easy) wraps the source in a derived table aliased `<table>__scoped` rather than applying `LIMIT` beside the aggregate.

### Failure modes

- The scoped and unscoped numbers match on data where they should differ.
- The query errors rather than returning a number.
- The number is neither the full sum nor the top-2 sum — a third value indicates the wrap is scoping something other than what the chain names.

### Restore

Delete the script you added. `git status --porcelain` matches the pre-flight baseline.

## Scenario 2 — Reduce over deduped rows and read the number (judgement)

**What you're proving from the user's seat:** observable-quality judgement on the one combination whose failure mode is a *plausible* wrong answer rather than an error. `distinct()` + `orderBy` + `take` requires the ordering to be reapplied after the `ROW_NUMBER` dedup wrap; if it is not, the query still runs, still returns a number, and that number is computed over an arbitrary subset. No exit code reveals this.

**Covers:** AC-6

**Isolation:** `workspace`

**Oracle:** your own hand-computed answer. For the seeded rows: group by the distinct column, take the highest-ordering row in each group, sort those representatives by the order column descending, take the first N, sum. Compute it on paper before running.

**Preconditions:**
- Scenario 1 completed (reuses its demo setup and seed knowledge).

### Steps

1. Pick a column with duplicate values across rows and a numeric column that varies within those duplicate groups.
2. On paper, work out what `.distinct('<dupCol>').orderBy((m) => m.<num>.desc()).take(2).aggregate((agg) => ({ total: agg.sum('<num>') }))` *should* return.
3. Run it.
4. Now run the same chain **without** `.take(2)` and note that number too.

### What you should see

- Step 3's number matches your paper answer exactly.
- Step 3 and step 4 differ — if `take` had no effect, the reapplied ordering is not doing its job.
- Look at the emitted SQL: there should be a `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` wrap, and an `ORDER BY` applied **outside** it against the ranked alias before the `LIMIT`. An `ORDER BY` that appears only inside the wrap is the defect this scenario exists to catch.

### Failure modes

- The number differs from your paper answer.
- The emitted SQL has no `ORDER BY` between the dedup wrap and the `LIMIT`.
- Adding or removing `.take()` does not change the answer.

### Restore

Delete any script added. `git status --porcelain` matches baseline.

## Scenario 3 — Ask SQLite for `distinctOn` and read the refusal (negative control)

**What you're proving from the user's seat:** that a guardrail this PR shipped actually gates, and that its diagnostic helps a stranger. Before this slice, `.distinctOn()` on SQLite type-checked, ran, and silently returned undeduped rows. The suite now asserts a throw; what it cannot assert is whether the message tells someone what to do about it.

**Covers:** AC-6

**Isolation:** `workspace`

**Oracle:** the message as a developer who has never read this PR would read it. Ask: does it name the capability, name the method, and imply the remedy? Compare against the sibling lane's wording, which this deliberately mirrors — `sql-builder`'s runtime gate throws `distinctOn() requires capability postgres.distinctOn`.

**Coverage boundary:** this proves the gate fires for a SQLite-target contract reaching `.distinctOn()` through the ORM's public surface. It does **not** prove every capability-less contract shape is rejected, nor that other capability-gated methods are gated — only the one construction you build here.

**Preconditions:**
- A SQLite-target contract. The in-test `defineContract` composition at `test/integration/test/sql-orm-client/count-terminal-interleaving.test.ts` shows the shape; build one in a scratch script rather than editing that test.

### Steps

1. In a scratch script, compose a SQLite runtime and collection against a SQLite-target contract.
2. Write `.orderBy(…).distinctOn('<field>')` on it. **Do not** add `@ts-expect-error`.
3. Run `pnpm typecheck` (or your editor) and read the compile error verbatim. Record it.
4. Now silence the type error with a cast, run the script, and read the runtime error verbatim. Record it.
5. Repeat step 2 against a **Postgres**-target contract and confirm it compiles and runs.

### What you should see

- Step 3 produces a compile error, not a successful build.
- Step 4 produces a thrown error naming the capability. Judge the message: could a developer who has never seen this PR work out what to do?
- Step 5 compiles and runs unchanged — the gate is invisible on a capable target. **This half matters as much as the refusal**; a gate that also blocks Postgres would be a regression the throw-assertion tests would not catch.

### Failure modes

- Step 2 compiles when it should not.
- Step 4 returns rows instead of throwing.
- The message names an internal identifier, or says only "capability missing" without naming which.
- Step 5 fails — the gate misfires on a capable target.

### Restore

Delete the scratch script and any SQLite file it created. `git status --porcelain` matches baseline.

## Scenario 4 — Read the new TSDoc as a stranger would (judgement)

**What you're proving from the user's seat:** durable-doc read. This slice changed what an existing chain returns. A developer who wrote `.take(10).aggregate(…)` last month gets a different number now, and TSDoc is where they will meet the rule — there is no user-facing ORM chaining guide in `docs/`. Nothing in CI checks whether hover text is legible or whether the example is discoverable at the moment of confusion.

**Covers:** AC-8

**Isolation:** `read-only`

**Oracle:** the spec's § At a glance, which states the intended semantics in prose. The TSDoc should convey the same rule to someone who has not read the spec.

### Steps

1. Open `packages/3-extensions/sql-orm-client/src/collection.ts` in an editor with TSDoc hover.
2. Hover `aggregate()`, `take()`, and `skip()` in turn. Read what a user would see — the rendered hover, not the raw comment.
3. Copy the worked example out of `aggregate()`'s TSDoc into a scratch file against the demo's contract. Compile it.
4. Ask, without looking at the spec: from these three hovers alone, would you know that `.take(10).aggregate(…)` reduces over ten rows rather than all of them?

### What you should see

- The rule is stated, not merely implied by an example.
- The worked example's two numbers differ, so the rule is visible rather than asserted.
- Step 3 compiles as written.
- Nothing forward-references grouped behaviour that does not exist yet — no "in a future version", no "coming soon".

### Failure modes

- The example does not compile.
- The example's numbers coincide, so it illustrates nothing.
- The prose describes grouped behaviour, which this slice did not ship.
- A reader finishing step 4 says "no".

## Scenario 5 — Page past the first rows on SQLite

**What you're proving from the user's seat:** re-enactment of a defect this slice predicted from renderer source, confirmed empirically, and fixed. `.skip(n)` without `.take()` previously emitted SQL SQLite could not parse — and it was broken for `.all()` too, long before this project existed.

**Covers:** AC-4

**Isolation:** `tmpdir`

**Oracle:** hand-computed arithmetic over your seed rows: the sum of all rows minus the first `n` in the query's order.

**Preconditions:**
- A SQLite database in your scratch directory.

### Steps

1. In `$PN_QA_TMP/scenario-5`, compose a SQLite runtime with a small table and seed rows with a numeric column whose values you choose.
2. Compute by hand: the full sum, and the sum after dropping the first 2 rows in id order.
3. Run `.orderBy((m) => m.id.asc()).skip(2).aggregate((agg) => ({ total: agg.sum('<num>') }))`.
4. Run the same chain with `.all()` instead of the aggregate, and count the rows returned.

### What you should see

- Step 3 returns your hand-computed skipped sum — **not** a syntax error near `OFFSET`, which is what it did before this slice.
- Step 4 returns `total rows − 2`, confirming the fix reaches the row-returning path too and not only aggregates.

### Failure modes

- Either step throws a SQL syntax error.
- Step 3's number equals the full sum — the offset was dropped.
- Step 4 returns all rows.

### Restore

Remove `$PN_QA_TMP/scenario-5`. Nothing outside the scratch directory should have changed.

## Scenario 6 — Exploratory: clause combinations the script did not enumerate

**Charter.** Explore the root `.aggregate()` surface with the demo contract for 30 minutes; discover clause combinations that return surprising numbers, produce confusing errors, or behave differently from what the TSDoc implies. Deliberately probe the seams this slice touched but no scripted scenario combines: `cursor` together with `distinct`; `skip` without `orderBy`; `take(0)`; a variant-narrowed collection ordered by a variant-owned field; an aggregate spec whose selectors all lack a column; two selectors reading the same column; an aggregate on a chain carrying an `include`.

**Covers:** (no specific AC; surfaces unknowns)

**Isolation:** `workspace`

**Time budget:** 30 minutes. Stop when the timer rings even if you have ideas left — log the unexplored ones as candidate scenarios for a future round.

**Notes capture:** record what you tried, what surprised you, and anything that felt off but you cannot yet name. A number you had to think about for more than a few seconds to confirm is worth recording even if it turns out correct.

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| -- | ---------------------------------- |
| AC-1 | The baseline snapshot was generated on pre-change source. That is a property of commit ordering, verified at review time by reading `git show --stat`. There is nothing for a user to observe. |
| AC-2 | "Baseline snapshot byte-unchanged" is a CI mechanism. Re-running the suite locally proves only that your machine matches CI, and inspecting the `.snap` file is not a user observation. |
| AC-3 | Helper placement in `query-plan-scope.ts` is a structural property with no user-observable surface. The reviewer verified the move character-for-character. |
| AC-5 | Whether `test/aggregate-pagination.test.ts` still contains `it.fails` is a test-suite property. CI enforces it on every push. |
| AC-7 | The integration tests themselves are CI artefacts. Scenarios 1, 2 and 5 are the user-seat versions of what they assert — driving the published surface against real databases rather than re-running the suite. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| ----- | ----------------------- |
| AC-1 | (CI / review; not manual-QA scope) — see "Scenarios deliberately not in this script" |
| AC-2 | (CI; not manual-QA scope) |
| AC-3 | (review; not manual-QA scope) |
| AC-4 | 1, 5 |
| AC-5 | (CI; not manual-QA scope) |
| AC-6 | 1, 2, 3 |
| AC-7 | (CI; scenarios 1, 2, 5 are the user-seat equivalent) |
| AC-8 | 4 |
