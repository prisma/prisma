# Manual QA — grouped-pagination (position decides what a clause means around `groupBy()`)

> **Be the user.** You are an application developer — most likely one arriving from Prisma — who writes a chain with `groupBy()` in it and pagination somewhere nearby. Before this slice, everything you wrote before `groupBy()` was dropped on the floor, silently. Now position decides meaning: clauses **before** `groupBy()` scope which rows get grouped, clauses **after** it page the groups themselves. Your job is to sit in that seat and judge the two things the test suite structurally cannot — whether the surface *tells* you which reading you got, and whether the new compile error tells you what to do about it.
>
> **Out of scope of this script.** Do not re-run `pnpm --filter @internal/sql-orm-client test`, the integration suite, `pnpm typecheck` as a green-check ritual, or the baseline snapshot. This slice shipped unit tests on both positions, a negative type test on the gate, and values-level integration tests on PGlite *and* SQLite. Re-running any of them here proves only that your machine matches CI. In particular: do **not** "verify the compile error exists" by running the `.test-d.ts` file — CI already does. Scenario 1 reads the message, which is a different act.
>
> **Also out of scope: "this method needs more TSDoc" findings.** The operator reviewed the comments this project added and had them deleted as restating what the signatures say, with a standing instruction to trim aggressively; the project spec records that as a deliberate refusal (§ Project Definition of Done, the position-semantics documentation item, split 2026-08-20). Sparse hovers here are working as decided. Scenarios 1 and 3 both *read* TSDoc as input to a judgement — neither audits it as an artefact, and neither should produce "add TSDoc" as a remedy.
>
> **Consumer audiences covered.** Per `drive/calibration/patterns.md § Consumer audiences`, this slice's surface is an **end-user** surface: `groupBy()` and the grouped chain are the published ORM builder. Every scenario below drives `examples/prisma-8-demo` against its own emitted contract and a real Postgres. Nothing here touches the extension-author substrate — this slice added no capability gate, no error subcode, and no export-surface change, so there is no extension-author-facing seam to exercise.
>
> **Spec:** `projects/aggregate-pagination/slices/grouped-pagination/spec.md`
> **Plan:** `projects/aggregate-pagination/slices/grouped-pagination/plan.md`
> **Project spec:** `projects/aggregate-pagination/spec.md`
> **Slice 1's script (shape reference, and the root-position half of the same rule):** `../aggregate-row-scope/manual-qa.md`
> **PR:** _(fill at PR-open)_

## Acceptance criteria key

The slice spec states its done conditions as prose bullets. This script numbers them so the coverage map can reference them, and adds two rows the parent project's DoD makes this slice's to close.

| ID | Criterion | Source |
| -- | --------- | ------ |
| AC-1 | `test/aggregate-pagination.test.ts` contains no `it.fails`; the grouped case is rewritten and passing | slice spec, done condition 1 |
| AC-2 | A test drives pre-group and post-group pagination in the same chain, with different values, and both land in the right place | slice spec, done condition 2 |
| AC-3 | Post-group `take`/`skip` without a prior `orderBy` is a compile error, asserted with `@ts-expect-error` | slice spec, done condition 3 |
| AC-4 | Integration tests assert **values** on both PGlite and SQLite for both grouped positions | slice spec, done condition 4 |
| AC-5 | Root `.aggregate()`'s compiled output is unchanged — the baseline snapshot still holds | slice spec, done condition 5 |
| AC-6 | Position semantics are uniform in every combination, including with `having()` and `where()` present | project spec, § Cross-cutting requirements |
| AC-7 | The position-semantics rule is documented where a user meets it. **Split on 2026-08-20**: the TSDoc half is a recorded operator refusal and is not QA'd here; the user-facing docs + release-note half is outstanding and is what scenario 3 is evidence about | project spec, § Project Definition of Done |

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Write post-group `take()` without `orderBy()` and read the refusal **(judgement, negative control)** | The gate this slice shipped fires *and* tells a stranger the fix is "order the groups first" — proven-to-fail is not the same as proven-to-help | `workspace` | AC-3 |
| 2 | Arrive from Prisma and write `.take(n).groupBy(…)` **(judgement)** | Both readings are legitimate; the surface makes legible *which one you got*, without you having read this PR | `workspace` | AC-2, AC-6 |
| 3 | Predict which reading you'll get, from what a user actually reads **(judgement)** | Whether the discovery surface as a whole lets someone who never read this PR predict which of the two readings their chain gets | `read-only` | AC-7 |
| 4 | Exploratory: clause combinations the scripted cases skipped | Surfaces unknown unknowns across `where` × `having` × both pagination positions × `distinct` | `workspace` | (no AC; charter) |

> Scenario 1 is a **negative control** in the sense the skill means — it plants the violation (the un-ordered chain) and observes the gate fire — but its point is the *message*, so it is also a judgement scenario. Scenarios marked **(judgement)** require evaluation against an explicit oracle no test asserts. Scenario 4 is a time-boxed charter with no scripted steps.
>
> The **Isolation** column tells the runner how to schedule the scenario in parallel: `tmpdir` (own scratch dir), `workspace` (own `git worktree`), `read-only` (no isolation needed), `external` (network-bound).

## Pre-flight

1. `git -C <repo> status --porcelain` — record the baseline. The tree should carry only `projects/aggregate-pagination/` as untracked.
2. `pnpm build`. Slice 1's QA round hit stale `dist/` artifacts in this worktree more than once. If a scenario fails with a module-resolution or `command not found` error, rebuild the named package before treating it as a finding.
3. Bring up the demo's database. **Read slice 1's QA report first** (`../aggregate-row-scope/manual-qa-reports/2026-08-18-qa-runner.md`, § Environment provisioning): the repo-root `docker-compose.yaml` ships plain `postgres:15-alpine`, which cannot satisfy the demo's `pgvector` requirement. That report's finding F-5 records the working substitute (`pgvector/pgvector:pg15`). Do not rediscover this.
4. `pnpm --filter prisma-8-demo seed`, then confirm the demo's `Post` rows: it has a `priority` enum (a small, legible group key) and three nullable engagement counters (`viewCount`, `impressionCount`, `reachScore`). `groupBy('priority')` with `sum('viewCount')` is the chain these scenarios use.

## Scenario 1 — Write post-group `take()` without `orderBy()` and read the refusal

**What you're proving from the user's seat:** that the guardrail this slice shipped is *usable*, not merely present. `test/grouped-pagination-gate.test-d.ts` asserts the call fails to compile — it says nothing about what the developer then sees. The implementation narrows the parameter to `never` (`grouped-collection.ts`, `take(n: HasOrderBy extends true ? number : never)`), so the raw diagnostic a user meets is some form of *"Argument of type 'number' is not assignable to parameter of type 'never'"*, which names neither `orderBy` nor the reason. Whether the TSDoc hover rescues that is the judgement this scenario exists to make. No test can assert it.

**Covers:** AC-3

**Isolation:** `workspace`

**Oracle:** two comparisons, both concrete.
1. **The sibling gate.** `cursor()` at the root position gates on `hasOrderBy` the same way (`packages/3-extensions/sql-orm-client/src/collection.ts:865-869`) — this slice deliberately mirrored it. Write the un-ordered `cursor()` call too and compare the two diagnostics side by side. If they read identically badly, you have found a house-level property, not a slice regression — say so in the finding, because it changes what the fix would be.
2. **The stranger test.** A developer who has never read this PR, holding only the editor's output (error text *plus* whatever hover is available at the error site), should be able to work out that the fix is "call `orderBy(...)` on the grouped collection first." Judge that as a yes/no, and record the exact text you judged. If the answer is no, report *that* — do not propose "more TSDoc" as the remedy; per the frame above, the shape of the fix is not yours to assume, and a `never` narrowing that points at the wrong thing is a type-level problem, not a comment-level one.

**Coverage boundary:** this proves the gate refuses `take()`/`skip()` on a grouped collection with no prior `orderBy()`, through the demo's published ORM surface. It does not prove every mis-ordered chain is refused, nor that the gate survives the collection being passed through a helper function or stored in an intermediate variable — probe that in scenario 4 if you have budget.

**Preconditions:**
- The demo typechecks cleanly at baseline: `pnpm --filter prisma-8-demo typecheck` exits 0 before you start. (This is a baseline reading, not a QA assertion — you need to know the error you are about to read is yours.)

### Steps

1. In `examples/prisma-8-demo/`, create a scratch file **`src/scratch-qa/scenario-1.ts`** importing the demo's `db` (see `src/prisma/db.ts`).

   **The `src/` prefix is load-bearing — do not drop it.** The demo's `tsconfig.json` includes `src/**`, `test/**`, `scripts/**` and `prisma/**` only. A scratch file at the demo root — `examples/prisma-8-demo/scratch-qa/`, without the `src/` — is outside every one of them, so `pnpm --filter prisma-8-demo typecheck` **exits 0 with the violation planted** — on a negative control, which would read as "the gate doesn't fire" and produce a false blocker. A file outside the include also resolves none of the demo's types, which will make correct model access look broken.

   On model access: confirm the exact form against a file that already compiles in the demo before assuming one. Slice 1's report drove it as `db.Post.…`; the chaining guide under `docs/reference/` writes `db.orm.<Model>`. If the form below doesn't resolve, fix the *access form*, not the chain — the chain is what's under test.
2. Write, with **no** `@ts-expect-error` and no cast:
   ```ts
   await db.Post.groupBy('priority')
     .take(2)
     .aggregate((agg) => ({ total: agg.sum('viewCount') }));
   ```
3. Run `pnpm --filter prisma-8-demo typecheck` and record the diagnostic **verbatim**, including the code (`TS2345` or whatever it emits) and the span it points at.
4. Open the same file in an editor with TSDoc hover. Hover `take` at the error site. Record what renders — is the "Requires a prior `orderBy(...)`" sentence visible at the moment the error is, or does reaching it take a deliberate second action?
5. Repeat steps 2–4 with `.skip(2)` in place of `.take(2)`.
6. Now write the **ordered** form and confirm it compiles:
   ```ts
   await db.Post.groupBy('priority')
     .orderBy((group) => group.priority.asc())
     .take(2)
     .aggregate((agg) => ({ total: agg.sum('viewCount') }));
   ```
7. Write the root-position sibling for comparison: `db.Post.cursor(…)` with no prior `orderBy()`. Record its diagnostic verbatim alongside the ones from steps 3 and 5.

### What you should see

- Steps 3 and 5 produce a compile error, not a successful build.
- The error text itself. Read it as text, not as an exit code: does it name `orderBy`? Does it name the grouped collection? Or does it bottom out in `never`?
- Step 4's hover: whether the TSDoc that *does* explain the rule is reachable from where the user is standing.
- Step 6 compiles. **This half matters as much as the refusal** — a gate that also blocked the correct form would be a regression the `@ts-expect-error` test cannot catch, because that test only asserts the *failing* calls fail.
- Step 7's `cursor()` diagnostic, for the side-by-side.

### Failure modes

- Step 2 or step 5 compiles when it should not.
- Step 6 fails to compile — the gate misfires on the correct chain.
- The error text, plus the hover reachable at the error site, leaves a stranger unable to name the fix.
- The `never` narrowing produces a diagnostic that points at the wrong span (e.g. the `aggregate()` call rather than `take()`), which would send a user looking in the wrong place.
- `take()` and `skip()` behave differently from one another.

### Restore

Delete `examples/prisma-8-demo/src/scratch-qa/`. `git status --porcelain` matches the pre-flight baseline.

## Scenario 2 — Arrive from Prisma and write `.take(n).groupBy(…)` (judgement)

**What you're proving from the user's seat:** end-to-end journey smoke on the migration path, and the legibility question underneath it. A Prisma user writes `prisma.post.groupBy({ by: ['priority'], take: 2 })` and gets *two groups back*. Written against this builder as `.take(2).groupBy('priority')`, the same intent now yields **row-scoping** — a well-defined, deliberate, and completely different answer. Both readings are legitimate and the project chose position to disambiguate them; what nobody has yet judged is whether a user who guessed wrong finds out. The integration suite asserts both readings are correct in isolation. This scenario asks whether the *surface* distinguishes them for someone who did not know there were two.

**Covers:** AC-2, AC-6

**Isolation:** `workspace`

**Oracle:** arithmetic you compute by hand from the seeded rows, written down **before** you run anything. For the demo's posts: (a) the per-priority counts and `viewCount` sums over all rows; (b) the same over only the top-N rows by `viewCount` descending; (c) the first N groups by priority ascending. These are three different answers, and you should know all three before the database tells you any of them.

**Preconditions:**
- Demo database seeded and reachable (pre-flight step 3–4).
- Seed rows that **discriminate**: at least one priority group must lose rows under pre-group scoping, and the number of distinct priorities must exceed the post-group `take`. If the demo's seed does not satisfy this, extend it in your scratch script — an oracle where two readings coincide proves nothing, and that is the failure mode slice 1's plan called out by name.

### Steps

1. Read the seeded `Post` rows (`priority`, `viewCount`). Write down the three hand-computed answers named in the Oracle.
2. In `examples/prisma-8-demo/src/scratch-qa/scenario-2.ts`, run the **pre-group** form and record the result:
   ```ts
   await db.Post.orderBy((p) => p.viewCount.desc())
     .take(2)
     .groupBy('priority')
     .aggregate((agg) => ({ count: agg.count(), total: agg.sum('viewCount') }));
   ```
3. Run the **post-group** form and record the result:
   ```ts
   await db.Post.groupBy('priority')
     .orderBy((group) => group.priority.asc())
     .take(2)
     .aggregate((agg) => ({ count: agg.count(), total: agg.sum('viewCount') }));
   ```
4. Run **both positions in one chain**, with different values, and record the result:
   ```ts
   await db.Post.orderBy((p) => p.viewCount.desc())
     .take(4)
     .groupBy('priority')
     .orderBy((group) => group.priority.asc())
     .take(2)
     .aggregate((agg) => ({ count: agg.count(), total: agg.sum('viewCount') }));
   ```
5. Add `.where(…)` (any predicate that drops rows) to the front of the chain in step 4, and a `.having((h) => h.count().gte(2))` between `groupBy` and the post-group `orderBy`. Re-compute by hand, then run.
6. Log the emitted SQL for steps 2, 3 and 4 (the demo prints `[SQL]` — slice 1's QA report shows the form). Read all three.
7. **The legibility judgement.** Having seen the results: if you had written step 2's chain expecting step 3's answer, what in the developer's environment would have told you? Consider, in order: the returned shape, the TSDoc hover on `groupBy`, the hover on the root `take`, the emitted SQL. Record which of those (if any) would have caught the mistake, and how far the user has to go to reach it.

   **"Nothing would have told me" is the expected answer, and it is the finding — stop there.** Do not carry it one step further into "so the hover should say more": the TSDoc half of this DoD item is a recorded operator refusal (see the frame at the top of this script, and scenario 3's scope note). Report what the user was left with; the shape of the remedy is not yours to propose.

### What you should see

- Step 2's numbers match hand-computed answer (b), **not** (a). At least one priority group should be absent or reduced relative to (a) — if the two coincide on your seed, the seed does not discriminate; fix it and re-run rather than recording a pass.
- Step 3 returns exactly 2 groups, matching answer (c), with counts computed over **all** rows in each group.
- Step 4's two `take` values both land: 4 rows are scoped in, then 2 groups come out. If either value is missing from the answer, the pre-group and post-group states have merged — the single defect this slice's design exists to prevent.
- Step 5's `having()` filters groups **after** grouping and **before** the post-group page. Concretely: the post-group `take(2)` should page the *survivors* of `having()`, not the pre-`having()` group set.
- Step 6's SQL: the pre-group form wraps the source in a derived table aliased back to `posts` (not `posts__scoped` — slice 1 changed that deliberately so `GROUP BY posts.priority` resolves), with the group key present in the derived table's projection. The post-group form has `ORDER BY` / `LIMIT` on the outer grouped select, after `GROUP BY` and any `HAVING`. Step 4 has both, at their two levels.
- Step 7 is a written judgement, not a pass/fail. Record the answer even if it is "nothing would have told me" — especially then.

### Failure modes

- Any result disagrees with its hand-computed oracle.
- Step 4 shows only one of its two `take` values taking effect.
- Step 5's `having()` evaluates against the wrong row set, or the post-group page is applied before `having()` narrows the groups.
- The pre-group derived table omits the group key, or the query errors on a column resolving against nothing.
- Adding `.where(…)` changes which *position* a pagination clause is interpreted in — a chain that reads one way in one combination and another way in another is a failure of the project, not of a scenario.
- Step 7 concludes that nothing in the surface distinguishes the two readings.

### Restore

Delete `examples/prisma-8-demo/src/scratch-qa/`. Revert any seed extension you made. `git status --porcelain` matches the pre-flight baseline.

## Scenario 3 — Predict which reading you'll get, from what a user actually reads (judgement)

**What you're proving from the user's seat:** durable-doc read, over the whole discovery surface rather than one artefact in it. This slice changed what an existing chain returns: a `.take(10).groupBy('x')` written last month was a no-op and is now row-scoping. Scenario 2 establishes what the two readings *are*; this one asks whether a user who never read this PR could have **predicted** which one they'd get, using only material they would actually encounter — editor hovers, `docs/`, the package README, the release notes. That is a question about the discovery surface as a whole, and nothing in CI asks it.

**Covers:** AC-7 (the docs + release-note half; see the scope note below)

**Isolation:** `read-only`

**Oracle:** the slice spec's § At a glance, which states the rule in prose with both compiled forms side by side. A user who has read only user-facing material should end up knowing what that section says. The judgement is binary and recorded as such: **could they predict the reading, yes or no**, and from which artefact.

**Scope note — a bare-TSDoc finding is out of scope here.** The project spec's DoD item was split on 2026-08-20 (`projects/aggregate-pagination/spec.md`, § Project Definition of Done, under the position-semantics documentation item). The **TSDoc half is a recorded refusal**: the operator reviewed the comments this project added, had them deleted as restating what the signatures say, and left a standing instruction to trim aggressively. `groupBy()`'s hover being *silent* on position semantics is therefore working as decided — and it is silent, not wrong: "switch to grouped-aggregate mode", "one row per group with the chosen key columns" all remain true after this slice, and its example uses `.where()`, which position semantics do not affect. Do not file "TSDoc doesn't explain position semantics" as a finding. The **docs + release-note half is genuinely outstanding** — no slice delivered it — and that is what this scenario is evidence about.

**Expected outcome today, stated up front so a "no" is not mistaken for a surprise:** the answer to step 5 is expected to be **no**, because the user-facing docs and the release note have not been written yet. The value of running this now is a concrete record of *what a user is left with in the meantime* and *which artefact they reached for first* — which is the input the closing docs dispatch needs. Re-run this scenario after those land; it should flip to yes, and if it does not, the docs did not solve the problem they were written for.

**Preconditions:**
- None. Read-only inspection of material already on the branch.

### Steps

1. Put the spec down. From here to step 5, read only what a user could reach.
2. Search the user-facing documentation surface for the rule: `docs/`, `packages/3-extensions/sql-orm-client/README.md`, the demo's `README.md` and `new-api.md`, and `docs/releases/`. Orientation as you go: `docs/reference/query-patterns.md` covers the sql-builder DSL, and the ORM chain is a different surface — its silence on position semantics is not evidence either way, so don't bank it as a finding. Record what you find and, precisely, where you looked before giving up.
3. In an editor with TSDoc hover, hover `groupBy()` (`packages/3-extensions/sql-orm-client/src/collection.ts`) and then `orderBy()`, `take()`, `skip()` on the grouped collection (`src/grouped-collection.ts`). Record what each conveys — as *input to step 5's judgement*, not as an artefact under audit.
4. Copy any worked example you found in step 2 or step 3 into a scratch file against the demo's contract and compile it.
5. **The judgement.** From steps 2–4 alone: would you know that `.take(10).groupBy('x')` scopes rows while `.groupBy('x').orderBy(…).take(10)` pages groups, and that they are different? Answer yes or no, name the artefact that got you closest, and name what it would have taken to get to yes.
6. Separately, check the two forward-reference traps: does anything a user reads promise `cursor()` on the grouped collection or aggregate-alias ordering (`orderBy: { _sum: … }`)? Both are explicit project non-goals.

### What you should see

- Step 2 turning up **nothing** on the ORM chain's position semantics — this is the expected state and the substance of the finding. Record the search path, not just the null result: a future docs dispatch needs to know where a user looked.
- Step 3's hovers conveying the local mechanics (what `take` on a grouped collection does, that it needs a prior `orderBy` and why) without ever putting the two positions side by side. That is the shape a per-method surface produces, and it is why the rule needs a prose home rather than more hovers.
- Any worked example compiling as written (step 4).
- Step 5 answered explicitly, with the "what it would have taken" half filled in — that sentence is the deliverable this scenario exists to produce.
- Nothing forward-referencing grouped `cursor()` or aggregate-alias ordering (step 6).

### Failure modes

- An example does not compile.
- The rule is discoverable only by reading the slice spec, which no user has. *(Expected today; record it with the search path from step 2, not as a surprise.)*
- Something a user reads describes the **pre-slice** behaviour — that clauses before `groupBy()` are ignored — which would now be actively wrong rather than merely absent. This is a different class from silence, and it is worth distinguishing carefully in the report.
- User-facing prose promises grouped `cursor()` or aggregate-alias ordering.
- A release note exists for this behaviour change but describes only one of the two positions.

## Scenario 4 — Exploratory: clause combinations the scripted cases skipped

**Charter.** Explore the grouped chain against the demo contract and a real Postgres for 30 minutes. Discover combinations that return surprising numbers, produce confusing errors, or behave differently from what the TSDoc implies. Deliberately probe the seams this slice touched that no scripted scenario combines:

- **Post-group `skip()` without `take()`.** The outer grouped select now carries `OFFSET` with no `LIMIT` — the exact shape slice 1 found SQLite could not parse and fixed in the renderer. The integration suite covers post-group `take`, not post-group `skip`-alone. If this errors, the remedy is a test, not a script scenario; say so in the finding.
- **`distinct()` / `distinctOn()` before `groupBy()`.** The compile path routes pre-group `distinct` through the same `ROW_NUMBER` wrap as the root position, and gates `distinctOn` on `postgres.distinctOn`. Neither is covered by a grouped test.
- **`where` + `having` + both pagination positions, all four present**, with values chosen so each clause's absence would be visible.
- **`cursor()` before `groupBy()`.** The project spec keeps cursor pre-group deliberately. Does a pre-group cursor reach the grouped scope?
- **Grouping by multiple fields**, then ordering post-group by the second key; and ordering post-group by a field that is *not* a group key (the type says it should be refused — confirm, and read what the refusal says).
- **Repeated post-group clauses**: `.orderBy(a).orderBy(b)` (appends?), `.take(5).take(2)` (replaces — the TSDoc says so; confirm).
- **`take(0)` in either position**, and post-group `skip` past the end of the group set.
- **The gate through an indirection**: assign `db.Post.groupBy('priority')` to a variable, pass it to a helper function, then call `.take(2)` — does the `HasOrderBy` flag survive?

**Covers:** (no specific AC; surfaces unknowns)

**Isolation:** `workspace`

**Time budget:** 30 minutes. Stop when the timer rings even if you have ideas left — log the unexplored probes as candidate scenarios for a future round.

**Notes capture:** record what you tried, what surprised you, and anything that felt off but you cannot yet name. A number you had to think about for more than a few seconds to confirm is worth recording even if it turns out correct. Delete any scratch files and confirm `git status --porcelain` matches the pre-flight baseline before finishing.

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| -- | ---------------------------------- |
| AC-1 | Whether `test/aggregate-pagination.test.ts` still contains `it.fails` is a test-suite property, enforced by CI on every push. `grep`-ing the file is not a QA pass, and the rewritten assertions target AST internals no user observes. |
| AC-2 | The *test* is a CI artefact. Scenario 2 step 4 is its user-seat equivalent — the same discriminating chain, driven through the published surface against a real database, judged against hand arithmetic rather than an AST shape. Listed as covered by scenario 2 for that reason, not for re-running the test. |
| AC-3 | The *assertion* that the call fails to compile is a CI artefact (`grouped-pagination-gate.test-d.ts`). What CI cannot assert is what the failure reads like, which is scenario 1's whole subject. |
| AC-4 | The integration tests themselves are CI artefacts and already assert values on both targets. Scenario 2 is the user-seat version — the published package surface against the demo's own emitted contract. SQLite is not re-driven manually here: the SQLite-specific risk this project carries is the `OFFSET`-without-`LIMIT` renderer shape, and scenario 4's charter names the one instance of it this slice newly creates. |
| AC-5 | "Baseline snapshot byte-unchanged" is a CI mechanism, and root `.aggregate()` is slice 1's surface, already QA'd in that slice's round. Re-running the suite locally proves only that your machine matches CI; inspecting the `.snap` file is not a user observation. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| ----- | ----------------------- |
| AC-1 | (CI; not manual-QA scope) — see "Scenarios deliberately not in this script" |
| AC-2 | 2 |
| AC-3 | 1 |
| AC-4 | 2 (user-seat equivalent; the tests themselves are CI) |
| AC-5 | (CI; not manual-QA scope) |
| AC-6 | 2 |
| AC-7 | 3 (docs + release-note half only; the TSDoc half is a recorded refusal — see scenario 3's scope note) |
