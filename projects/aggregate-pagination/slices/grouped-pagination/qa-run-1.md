# Manual QA report — grouped-pagination (position decides what a clause means around `groupBy()`) — 2026-08-20

> **Script:** `projects/aggregate-pagination/slices/grouped-pagination/manual-qa.md` (untracked at run time; unmodified by this run)
> **Runner:** qa-runner-2 (LLM session, fresh context — did not author the implementation or the script)
> **Environment:** Linux 7.1.6, Node v24.18.0, pnpm 10.27.0, Docker 29.6.2, Postgres 15.19 via `pgvector/pgvector:pg15` on port 5433
> **Branch / commit under test:** `grouped-pagination` @ `750b214a78` (the dispatched commit; scenarios 1, 2 and 4 ran in a detached worktree pinned there)
> **Started / finished:** 2026-08-20 17:30 UTC / 2026-08-20 18:06 UTC
> **Verdict:** ❌ Fail

## Summary

❌ **Fail.** One 🛑 Blocker: a post-group `orderBy()` on an **enum** group key silently loses enum declaration order — degrading to plain text ordering — whenever the same chain also carries a pre-group scope. Because post-group `take`/`skip` page that order, the chain returns **a different group** than the one the user asked for, with no error (F-1). This is new to this slice: post-group `orderBy` did not exist before it. A second 🔧 fix-in-PR finding is an unfilled `<pr>` placeholder shipping in the rc.5 release note (F-3). Six findings total; all carry a proposed disposition. All four scenarios ran.

**The charter's `skip()`-without-`take()` probe did NOT fire.** Post-group `skip()` with no `take()` works on Postgres, and I drove the same shape on **SQLite** — where slice 1's renderer fix lives — and it passed there too. The renderer's `LIMIT -1` compensation is written generically in `renderSelect`, so it covers the grouped path. The *coverage* gap the dispatch described is real, though: no test exercises it (F-6).

## A note on what moved underneath this run

HEAD advanced during the run, by another agent on the same branch:

```
750b214a78  (dispatched commit — scenarios 1, 2, 4 pinned here)
798a9d5ff2  docs(sql-orm-client): ORM collection chaining guide + rc.5 release note
040f326bd9  docs(upgrade): record grouped-pagination's extension-author instructions   <- HEAD at finish
```

This matters for **scenario 3 only**, which is `read-only` and which I ran against the live checkout rather than the pinned worktree. Its result therefore describes the branch **including `798a9d5ff2`**, not the dispatched commit. I verified both states explicitly:

- At `750b214a78`: `docs/reference/ORM Collection Chaining.md` and `docs/releases/v8.0.0-rc.5.md` are both **absent**. The script's stated expectation ("the answer to step 5 is expected to be **no**") was correct as written.
- At HEAD: both exist, and the guide states the position rule with both compiled forms side by side.

So scenario 3's answer flipped from **no** to **yes** mid-run, because the closing docs dispatch landed while I was running. The script was not stale when written; I am recording the timing rather than a script defect. Scenarios 1, 2 and 4 are unaffected — their worktree stayed detached at `750b214a78` throughout.

## Findings

### F-1 — 🛑 Blocker — post-group `orderBy()` on an enum key silently loses declaration order when the chain has a pre-group scope, returning a different group

**Scenario:** 4 — Exploratory charter (isolated there); also visible in scenario 2 step 4
**Step:** charter probes A4 / A5
**Oracle:** `contract.prisma` declares `enum Priority { Low = "low"; High = "high"; Urgent = "urgent" }`. Enum ordering in this codebase means **declaration order** — `packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts:342` documents it, and `packages/3-targets/6-adapters/postgres/test/migrations/order-by-enum.integration.test.ts:152` asserts it. So `.orderBy((g) => g.priority.asc()).take(1)` must return the **`low`** group.

**Observed:** the two chains below reduce over an **identical row set** — the pre-group `take(8)` in A5 keeps all 8 rows, scoping nothing away. The only difference is that its presence creates the derived-table wrap. They disagree.

```
A4 — groupBy('priority').orderBy(priority asc).take(1)         [no pre-group scope]

[SQL] SELECT "post"."priority" AS "priority", COUNT(*) AS "count", SUM("post"."viewCount") AS "total"
      FROM "public"."post" GROUP BY "post"."priority"
      ORDER BY array_position(ARRAY['low', 'high', 'urgent']::text[], "post"."priority") ASC LIMIT 1

[{ "priority": "low", "count": 3, "total": 13400 }]
```

```
A5 — orderBy(viewCount desc).take(8).groupBy('priority').orderBy(priority asc).take(1)

[SQL] SELECT "post"."priority" AS "priority", COUNT(*) AS "count", SUM("post"."viewCount") AS "total"
      FROM (SELECT "post"."priority" AS "priority", "post"."viewCount" AS "viewCount"
            FROM "public"."post" ORDER BY "post"."viewCount" DESC LIMIT 8) AS "post"
      GROUP BY "post"."priority"
      ORDER BY "post"."priority" ASC LIMIT 1

[{ "priority": "high", "count": 2, "total": 10100 }]
```

The post-group `ORDER BY` degrades from `array_position(ARRAY['low','high','urgent']::text[], …)` to a bare `"post"."priority" ASC`. Declaration order is `low, high, urgent`; plain text order is `high, low, urgent`. With `take(1)` that is a **different group**, not merely a different order.

**Expected (per oracle):** `{ "priority": "low", "count": 3, "total": 13400 }` in both.

A third probe isolates the trigger to the *derived-table wrap* specifically, not to pre-group clauses in general:

```
A3 — where(viewCount >= 0).groupBy('priority').orderBy(priority asc).take(2)   [where only, no wrap]
[SQL] … FROM "public"."post" WHERE "post"."viewCount" >= $1 GROUP BY "post"."priority"
      ORDER BY array_position(ARRAY['low', 'high', 'urgent']::text[], "post"."priority") ASC LIMIT 2
→ low, high   ✅ enum order retained
```

**Root cause (pointer, not a diagnosis):** `renderOrderByExpr` at `packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts:343` applies the rewrite only when `resolveEnumOrderValues(expr, sourcesByRef, contract)` resolves the column-ref to an enum-restricted column. Slice 1 deliberately aliases the derived table back to the base table name so `GROUP BY "post"."priority"` resolves — but the *source* behind that alias is now a subquery, so the enum lookup returns `undefined` and the renderer falls through to plain column rendering. The existing suppression rule (`order-by-enum.integration.test.ts:67` — don't rewrite when a ref is ambiguous across a join) appears to swallow this case silently.

**Scope:** introduced by this slice. Post-group `orderBy` is this slice's own surface; before it, no `ORDER BY` was ever emitted *outside* the derived table, so this could not occur. Root-position enum ordering is unaffected — there the `ORDER BY` sits inside the derived table, where the source is still the base table (confirmed: the `DISTINCT ON` path at pre-group position emits `array_position(...)` correctly).

**Blast radius:** enum-typed group keys only. A `text`/`int` group key orders identically either way, so this is invisible unless the group key is enum-backed.

**Reproduction:**
- `git rev-parse HEAD` at run time → `750b214a78d1127db8c5929ffad479e1d55f162` (worktree detached here)
- `git status` at failure → clean but for the scratch dir noted in Restore
- Exact command: `pnpm exec tsx src/scratch-qa/probe-verify2.ts` from `examples/prisma-8-demo` in the pinned worktree
- Data: the demo's 3 seeded posts plus 5 QA rows (`QA-A1..A5`), giving `low{3,13400} high{2,10100} urgent{3,3412}` — verified directly against Postgres with `select priority, count(*), sum("viewCount") from public.post group by priority`
- Chains: exactly the two shown above

**Notes:** This is the one result in the run that disagrees with a hand-computed oracle, and per the standing rule I have not adjusted the oracle to match. It also partially falsifies **AC-6** — see the coverage table for the precise reading: *position* semantics did hold uniformly in every combination I drove; what is not uniform is the enum ordering rewrite.

### F-2 — 📝 Follow-up — the post-group gate's compile error is opaque, and the hover at the error site is empty

**Scenario:** 1 — Write post-group `take()` without `orderBy()` and read the refusal
**Step:** 3, 4, 5, 7
**Oracle:** (1) the sibling `cursor()` gate; (2) the stranger test — could a developer holding only the error text plus whatever hover is available *at the error site* name the fix?

**Observed** — steps 3 and 5, verbatim:

```
src/scratch-qa/scenario-1.ts(8,11): error TS2345: Argument of type '2' is not assignable to parameter of type 'never'.
src/scratch-qa/scenario-1.ts(16,11): error TS2345: Argument of type '2' is not assignable to parameter of type 'never'.
```

Line 8 col 11 is the `2` in `.take(2)`; line 16 col 11 is the `2` in `.skip(2)`. **The span is correct** — it points at the offending argument, not at `aggregate()`. `take()` and `skip()` are identical. The named failure modes "points at the wrong span" and "take/skip behave differently" both do **not** fire.

Step 4, the hover. I queried the TypeScript language service directly (`getQuickInfoAtPosition`) rather than eyeballing an editor:

- **At the error site** (the `2`, where the squiggle is): **no quickinfo returned at all.** The hover is empty.
- **On the method name `take`** (one deliberate cursor move, 5 columns left):
  ```
  (method) GroupedCollection<Contract, "Post", ["priority"], never, false>.take(n: never): …
  Apply `LIMIT n` to the grouped rows. Replaces any previous post-group
  limit. Requires a prior `orderBy(...)` — a database may return groups in
  any order, so "the first n groups" is undefined without one.
  ```

So the rescue sentence exists and is exact — but it is **not reachable from where the user is standing**. The script's step-4 question ("visible at the moment the error is, or a deliberate second action?") answers: *a deliberate second action*.

**The stranger test: no.** Holding the error text plus the hover available at the error site — which is empty — a developer cannot name the fix. `never` names neither `orderBy` nor grouping.

**Step 7, the sibling comparison — this is a house-level property, not a slice regression.** The root-position `cursor()` gate reads identically:

```
src/scratch-qa/scenario-1-cursor.ts(7,31): error TS2345: Argument of type '{ title: string; }' is not assignable to parameter of type 'never'.
```

Same `TS2345`, same `never`, same empty hover at the argument, same rescue sentence one move away on the method name. Slice 1's report already recorded the same pattern for `distinctOn()` (its F-2). This is the third instance of one `never`-narrowing house pattern, so a fix scoped to this PR alone would break the parity the slice deliberately mirrored.

**Worth contrasting:** the same slice produces one genuinely *good* diagnostic. Ordering post-group by a non-group key gives:

```
src/scratch-qa/probe-types.ts(30,55): error TS2339: Property 'viewCount' does not exist on type 'Pick<ModelAccessor<Contract, "Post", never>, "priority">'.
```

That names the offending property *and* shows the permitted set. The difference is `Pick<>` vs `never` — a type-level choice, which is the level any remedy here would live at.

**Step 6 — the positive half passed.** The ordered form compiles clean, `take` and `skip` both:

```
await db.Post.groupBy('priority').orderBy((group) => group.priority.asc()).take(2).aggregate(…)
await db.Post.groupBy('priority').orderBy((group) => group.priority.asc()).skip(1).aggregate(…)
→ zero diagnostics; pnpm typecheck exit 0 for that file
```

The gate does not misfire on the correct chain.

**Notes:** I am recording what the user was left with and stopping there. Per the script's frame the shape of the remedy is not mine to propose, and the `never`-vs-`Pick` contrast above is offered as observation, not prescription.

### F-3 — ⚠️ High — the rc.5 release note ships an unfilled `<pr>` placeholder

**Scenario:** 3 — Predict which reading you'll get
**Step:** 2 (documentation search)
**Oracle:** user-facing prose should be publishable as written.
**Observed:** `docs/releases/v8.0.0-rc.5.md:23`, the `groupBy()` bullet, ends:

```
([#<pr>](https://github.com/prisma/prisma/pull/<pr>))
```

The neighbouring `aggregate()` bullet on line 5 carries a real reference (`[#30067](…/pull/30067)`), so this is an unfilled slot rather than a house convention.

**Expected (per script):** the release-note half of AC-7 delivered. It is delivered — and it covers **both** positions, so the named failure mode "describes only one of the two positions" does not fire — but it would ship a link resolving to `/pull/<pr>`.
**Reproduction:**
- `git rev-parse HEAD` → `040f326bd9d399c2d59dbd450e78aabbf6a2eee0`
- Introduced by `798a9d5ff2`, on this branch, not on `main`
- Exact command: `grep -n "<pr>" docs/releases/v8.0.0-rc.5.md`

**Notes:** Trivially fixable and on this branch, so it should not leave with the PR.

### F-4 — 📝 Follow-up — the guide's and TSDoc's worked examples (`db.orm.<Model>`) do not compile in the flagship demo app

**Scenario:** 3 — step 4 ("copy any worked example … against the demo's contract and compile it")
**Oracle:** the script's named failure mode "An example does not compile."
**Observed:** every worked example in `docs/reference/ORM Collection Chaining.md`, and in the `groupBy()` / `take()` / `cursor()` TSDoc, is written as `db.orm.<Model>.…`. Against the demo's own client that does not typecheck:

```
src/scratch-qa/scenario-1.ts(4,14): error TS2339: Property 'Post' does not exist on type 'OrmClient<Contract, Record<never, never>>'.
```

The demo's ORM surface is reached via `createOrmClient(runtime)` (`examples/prisma-8-demo/src/orm-client/client.ts`), which registers collections explicitly; `db.orm` on the demo's `postgres<Contract>({ contractJson, … })` client carries no collections. The same `db.orm.<Model>` form *does* compile elsewhere in the repo — `test/e2e/framework/test/sqlite/transaction.test.ts:59` calls `db.orm.User.first()` against a client built analogously (`sqlite<Contract>({ contractJson, path })`) — so the demo is the outlier, not the docs.

**Reproduction:**
- `git rev-parse HEAD` → `750b214a78…` (observed in the pinned worktree)
- Exact command: `pnpm --filter prisma-8-demo typecheck` with a scratch file using `db.orm.Post`

**Notes:** I am reporting the mismatch, not adjudicating which side should move — that needs someone who knows why the demo registers collections manually. The user impact is concrete: a reader of the new guide who tries it in the flagship demo hits an error that has nothing to do with the rule being taught. Cost me ~10 minutes of this run for the same reason.

### F-5 — 📝 Follow-up — script defect: scenario 1's scratch path is outside the demo's tsconfig, so the script as written passes with the violation planted

**Scenario:** 1 (defect in the script, not the system)
**Step:** 1–3
**Observed:** the script says to create `examples/prisma-8-demo/scratch-qa/scenario-1.ts` and then run `pnpm --filter prisma-8-demo typecheck`. The demo's `tsconfig.json` `include` is `["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "scripts/**/*.ts", "prisma/**/*.ts", "prisma.config.ts"]` — `scratch-qa/` matches none of them. Run exactly as written, with the un-ordered `take(2)` planted:

```
> tsc --project tsconfig.json --noEmit
(no output)
VERBATIM_SCRIPT_CMD_EXIT=0
```

**Why this matters more than a normal script nit:** scenario 1 is the script's **negative control**. A runner following it literally sees a green typecheck with the violation in place, and the natural (wrong) conclusion is "the gate did not fire" — a false 🛑 Blocker, which the skill's own rubric says to file without hesitation. The script's most safety-critical scenario is the one its path bug misreports.

I worked around it by placing the scratch files under `src/scratch-qa/`, which the `include` does cover, keeping the script's command verbatim. A direct `tsc --project …` on a scratch tsconfig is not an option — a repo hook rejects it (`Use 'pnpm typecheck' instead of running tsc directly`).

**Second, smaller script inaccuracy:** step 1 says to import the demo's `db` and drive it as `db.Post.…` (citing slice 1's report). Neither `db.Post` nor `db.orm.Post` resolves in this demo; `createOrmClient(runtime).Post` is the working form. See F-4.

**Notes:** Per the skill I did **not** edit the script. Both items are for `drive-qa-plan` on the next revision.

### F-6 — 📝 Follow-up — no test covers post-group `skip()` without `take()`, the one new `OFFSET`-without-`LIMIT` shape this slice creates

**Scenario:** 4 — charter, the dispatch's priority probe
**Oracle:** the charter's own framing — this shape is what SQLite could not parse and what slice 1 fixed in the renderer; integration covers post-group `take`, not post-group `skip`-alone.

**The probe did not fire.** Postgres:

```
[SQL] SELECT "post"."priority" …, COUNT(*) AS "count", SUM("post"."viewCount") AS "total"
      FROM "public"."post" GROUP BY "post"."priority"
      ORDER BY array_position(ARRAY['low','high','urgent']::text[], "post"."priority") ASC OFFSET 1

[{ "priority": "high", "count": 2, "total": 10100 },
 { "priority": "urgent", "count": 3, "total": 3412 }]
```

Correct: declaration order is `low, high, urgent`, so `skip(1)` drops `low`.

Because the real risk is SQLite, I drove the same shape there too, with a scratch test on the existing SQLite harness (oracle hand-computed: 3 groups, `skip(1)` drops group 1, counts over all rows):

```
✓ post-group skip() with no take() offsets the group set
  Test Files  1 passed (1)   Tests  1 passed (1)   Type Errors  no errors
```

The fix holds because it is written generically in the shared select renderer, not special-cased to the root position — `packages/3-targets/6-adapters/sqlite/src/core/adapter.ts:254-258`:

```ts
// SQLite has no standalone OFFSET clause, so an offset with no limit needs an explicit LIMIT -1.
const limitClause =
  ast.limit === undefined && ast.offset !== undefined ? 'LIMIT -1' : renderLimitOffset('LIMIT', ast.limit, ctx);
```

Every grouped select passes through the same `renderSelect`, so the grouped path inherits the compensation.

**What remains is the coverage gap, which is real.** `test/integration/test/sql-orm-client/aggregate-sqlite.test.ts` has root-position `skip()`-alone (line 167) and post-group `take()` (lines 208, 233) — but nothing post-group `skip`-alone. The behaviour is correct today and nothing pins it.

**Reproduction:** scratch test appended to a copy of `aggregate-sqlite.test.ts`'s harness; the assertion body is reproduced in "Exploratory notes" below and is ready to paste in.

**Notes:** Per the dispatch's instruction, had this fired it would be a defect needing a test. It did not fire — so this is the test, minus the defect.

## Per-scenario log

| # | Scenario | Isolation | Wallclock | Result | Findings |
| - | -------- | --------- | --------- | ------ | -------- |
| 1 | Post-group `take()` without `orderBy()` — read the refusal (negative control) | `workspace` (detached worktree @ `750b214a78`) | ~14m | ⚠️ gate fires correctly; message judged inadequate | F-2, F-5 |
| 2 | Arrive from Prisma and write `.take(n).groupBy(…)` | `workspace` (same worktree) | ~9m | ⚠️ all set-level oracles matched; step 4's *order* wrong | F-1 (instance) |
| 3 | Predict which reading you'll get, from what a user reads | `read-only` (live checkout — see timing note) | ~7m | ✅ answer is **yes** at HEAD (was **no** at the dispatched commit) | F-3, F-4 |
| 4 | Exploratory: clause combinations the scripted cases skipped | `workspace` (same worktree) | ~30m (budget) | 🛑 blocker found | F-1, F-6 |

**Isolation deviation, stated plainly.** The skill prescribes one `git worktree` per `workspace` scenario. I used **one** detached worktree (`git worktree add --detach … 750b214a78`) shared by scenarios 1, 2 and 4, each with its own scratch subtree and its own Restore. Reasons: a second and third worktree each need a full `pnpm install` + `pnpm build` of this monorepo, and all three scenarios necessarily share the single Postgres instance anyway, so per-scenario worktrees would not have isolated the state that actually matters here. Execution was sequential, so no two scenarios were ever in flight against the same tree. The user's checkout was never used for any `workspace` scenario.

**Restore evidence.** After scenario 1, inside the worktree:

```
--- worktree status WITH scratch present ---
?? examples/prisma-8-demo/src/scratch-qa/
--- worktree status AFTER scenario-1 restore ---
(empty)
POST_RESTORE_TYPECHECK_EXIT=0
```

After scenarios 2 and 4, and after final teardown (`git worktree remove --force`), the user's checkout:

```
 M projects/aggregate-pagination/spec.md
?? projects/aggregate-pagination/slices/grouped-pagination/manual-qa.md
?? projects/aggregate-pagination/slices/grouped-pagination/pr-description.md
```

The first two are the expected pre-flight baseline. `pr-description.md` is **not mine** — it appeared during the run from another agent on this branch, alongside commits `798a9d5ff2` and `040f326bd9`. I created and removed: the worktree, `examples/prisma-8-demo/.env` (gitignored), `examples/prisma-8-demo/migrations/app/refs/` (written by `pnpm db:init`), all scratch files, and the `pn-qa-pgvector` container. No source file was edited.

## Exploratory notes

Ten probes inside the 30-minute budget. Everything the charter named was reached.

**The enum-ordering surprise that became F-1.** My first hand-computed oracle for scenario 2 assumed `priority.asc()` sorted alphabetically, since the enum is `@@type("pg/text@1")`. The first emitted SQL corrected me — `ORDER BY array_position(ARRAY['low', 'high', 'urgent']::text[], …)`, i.e. declaration order. I re-derived the oracle from the declared order and re-verified it against ground truth in the database. That correction is what made F-1 visible: once you know the intended order is `low, high, urgent`, a chain returning `high` first is obviously wrong rather than plausibly fine. Worth flagging that this is *good* behaviour that a user could easily mis-predict; it is well-specified and tested, just not where a chain-writer would look.

**Probes that behaved exactly as advertised** (no findings):

- *Repeated post-group `orderBy` appends.* `.orderBy(priority asc).orderBy(userId desc)` → `ORDER BY array_position(…) ASC, "post"."userId" DESC`.
- *Repeated post-group `take` replaces.* `.take(5).take(2)` → `LIMIT 2`, matching the TSDoc.
- *`take(0)` in both positions, and `skip` past the end.* `LIMIT 0` / derived-table `LIMIT 0` / `OFFSET 99` all → `[]`. No off-by-one, no error.
- *The gate through an indirection holds.* Assigning `db.Post.groupBy('priority')` to a variable and passing it to a helper still refuses `.take(2)` — `HasOrderBy` rides in the type, so the boundary does not launder it. The ordered form through the same helper compiles.
- *Ordering post-group by a non-group key is refused, and refused well* — the `Pick<>` diagnostic quoted in F-2.
- *`distinct('priority')` before `groupBy()`* routes through the `ROW_NUMBER` wrap exactly as the charter predicted: `ROW_NUMBER() OVER (PARTITION BY "post"."priority" ORDER BY "post"."viewCount" DESC) AS "__prisma_distinct_rn" … WHERE … = 1`, then grouped. Correct values.
- *`distinctOn('priority')` before `groupBy()`* compiles (the demo declares `postgres.distinctOn`) and emits `SELECT DISTINCT ON (array_position(…))`. Note the enum rewrite **is** applied here — consistent with F-1's root cause, since at this position the source is still the base table.
- *`cursor()` before `groupBy()`* reaches the grouped scope, lowering to a plain `WHERE "post"."viewCount" < $1` ahead of `GROUP BY`. Answering the charter's question: yes, a pre-group cursor reaches the grouped scope.
- *Grouping by two fields, ordering post-group by the second key* works (`ORDER BY "post"."userId" ASC LIMIT 3`).

**A false alarm I chased and retracted — worth recording as a method note.** I first read `distinct()` as being *silently dropped*: probes with `.distinct()` emitted SQL with no `DISTINCT` and no `ROW_NUMBER`, byte-identical to the same chain without it. That looked like exactly the silent-discard defect class this project exists to remove. It was my error: `distinct()` requires at least one argument, and my call had none. `tsx` does not typecheck, so the malformed call ran and no-opped at runtime; only when I later ran `pnpm typecheck` over the probe files did `TS2555: Expected at least 1 arguments, but got 0` surface it. Re-run with `.distinct('priority')`, the `ROW_NUMBER` wrap appears correctly. **No defect — retracted.** The generalisable lesson for the next runner: a runtime-only probe through `tsx` will happily execute a chain that does not compile, so any "clause seems ignored" observation must be typechecked before it is believed.

**Unexplored ideas for a future round:** post-group `skip` + `take` together paged across several pages for boundary behaviour; `groupBy` on a nullable enum column (NULL sorts via `array_position` returning NULL, per the renderer's own TSDoc — untested here); the F-1 shape on a `text` (non-enum) group key to confirm it is truly invisible there; and whether F-1 also affects `having()` expressions referencing the wrapped alias.

## Coverage outcome

| AC ID | Scenario(s) | Result | Notes |
| ----- | ----------- | ------ | ----- |
| AC-1 | (CI; not manual-QA scope) | N/A | Test-suite property; enforced on every push. |
| AC-2 | 2 | ✅ pass | Step 4 drove both positions with different values (`take(4)` pre, `take(2)` post) and **both landed**: pre-group scoping reduced `low` from `{3,13400}` to `{2,13000}`, and the post-group page dropped `urgent`. Steps 2, 3 and 5 each matched their hand-computed oracle exactly. The group *ordering* in step 4 is wrong (F-1), but the two `take` values both took effect, which is what AC-2 asserts. |
| AC-3 | 1 | ✅ pass, with F-2 | The gate fires on both `take` and `skip`, points at the right span, and does **not** misfire on the correct ordered chain (step 6). F-2 is about the message, not the gate. |
| AC-4 | 2 (user-seat) + charter SQLite probe | ✅ pass | Values verified against hand arithmetic through the published surface on Postgres; the SQLite path re-driven for the one shape integration misses (F-6). |
| AC-5 | (CI; not manual-QA scope) | N/A | Root `.aggregate()` is slice 1's surface. |
| AC-6 | 2, 4 | ❌ fail | Read precisely: **position semantics did hold uniformly** in every combination I drove — pre-group clauses scoped rows and post-group clauses paged groups with `where`, `having`, `distinct`, `cursor` and both pagination positions present. What is *not* uniform is the enum ordering rewrite, which silently changes meaning based on whether an unrelated earlier clause created a derived table (F-1). Marked fail because a 🛑 Blocker arose in a scenario covering this AC and because a chain does read one way in one combination and another way in another — the exact wording of the script's own failure mode. |
| AC-7 | 3 | ⚠️ pass at HEAD, with F-3 | The docs + release-note half is **delivered** (commit `798a9d5ff2`, landed mid-run — absent at the dispatched commit). The guide states the rule with both compiled forms and the release note covers both positions. Two blemishes: an unfilled `<pr>` placeholder (F-3) and examples that do not compile in the demo (F-4). The TSDoc half remains a recorded operator refusal and was not audited. |

## Disposition map

| Finding | Severity | Proposed disposition | Evidence / next step |
| ------- | -------- | -------------------- | -------------------- |
| F-1 | 🛑 Blocker | 🔧 fix-in-PR | Introduced by this slice; silently wrong results on its headline combination. Fix scoped to the enum-order resolution at `packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts:343` (`renderOrderByExpr` / `resolveEnumOrderValues`) so a derived-table-aliased ref still resolves to the enum column — plus a regression test on a post-group `orderBy` over an enum key **with** a pre-group scope, which must be red before the fix. |
| F-2 | 📝 Follow-up | 🎫 ticket | Not scoped to this PR: `cursor()` and `distinctOn()` (slice 1's F-2) share the identical `never`-narrowing pattern, and this slice mirrored `cursor()` deliberately. A fix here alone would break that parity. Ticket against the `never`-gated-method diagnostic pattern house-wide; the `Pick<>`-based refusal in the same slice is the in-repo precedent worth weighing. |
| F-3 | ⚠️ High | 🔧 fix-in-PR | One-line edit in `docs/releases/v8.0.0-rc.5.md:23`; the commit that introduced it (`798a9d5ff2`) is on this branch, so it should not leave with the PR. |
| F-4 | 📝 Follow-up | 🎫 ticket | Needs a decision I cannot make: either the demo registers collections so `db.orm.<Model>` works, or the guide's examples adopt the demo's `createOrmClient` form. Affects the whole ORM doc surface, not just this slice's page. |
| F-5 | 📝 Follow-up | 🎫 ticket | Script fix for `drive-qa-plan`, to land before the next run of this script: point scratch files at `src/scratch-qa/`, and correct the `db.Post.…` hint in step 1. Elevated above a normal nit because it misreports the negative control. |
| F-6 | 📝 Follow-up | 🔧 fix-in-PR | Cheap and this slice's own gap: add post-group `skip()`-without-`take()` to `test/integration/test/sql-orm-client/aggregate-sqlite.test.ts`. The assertion is written and passing — three groups, `orderBy(userId asc)`, `skip(1)`, expect `[{userId:2,count:2,total:70},{userId:3,count:1,total:50}]`. |

**Verdict basis:** F-1 and F-3 carry 🔧 fix-in-PR dispositions, and a 🛑 Blocker was observed in flight. Verdict is ❌ Fail; the PR is not merge-ready until those two land. Every finding carries a proposed disposition, so triage is complete on the runner's side — the 🎫 items still need the orchestrator to file them.

## Suggested follow-ups

- **F-1 (🔧 fix-in-PR) — blocks merge.** Fix the enum-order resolution across the derived-table boundary and add the red-first regression test. Confirm whether `having()` expressions over the wrapped alias suffer the same resolution failure; I did not probe that.
- **F-3 (🔧 fix-in-PR) — blocks merge.** Fill the `<pr>` placeholder in the rc.5 release note.
- **F-6 (🔧 fix-in-PR) — cheap.** Land the post-group `skip`-alone SQLite test. The behaviour is correct today and nothing pins it.
- **F-2 (🎫 ticket).** File against the `never`-gated-method diagnostic pattern house-wide, cross-referencing slice 1's F-2 (`distinctOn`) and `cursor()`. Three recorded instances now.
- **F-4 (🎫 ticket).** Decide whether the demo or the docs move so the guide's worked examples compile where a reader will try them.
- **F-5 (🎫 ticket, for `drive-qa-plan`).** Fix the scratch path and the `db.Post` hint before this script is run again. Consider adding a script convention that a negative control must first be shown to *fail* for the intended reason.
- **Re-run scenario 3 after the docs settle.** It flipped to **yes** mid-run. The script's own instruction — re-run once docs land, and if it does not flip, the docs did not solve the problem they were written for — is now satisfiable; this run is the "what a user was left with beforehand" record it asked for.
- **Consider a script scenario for enum-keyed grouping generally.** F-1 was found by the charter, not by a scripted case, because every scripted chain used a group key whose text order and declaration order happened to agree closely enough to hide it at `take(2)`. Only `take(1)` separated them.

---

## Orchestrator disposition (added after the run)

The report's ❌ Fail verdict stands as written — it was correct at the time and the findings are not being revised. This records what happened to each, so a later reader doesn't mistake a routed finding for an ignored one.

| Finding | Disposition |
| --- | --- |
| **F-1** enum `ORDER BY` degrades behind a derived table | **Confirmed, and wider than reported.** A renderer-level sweep reproduced it in four shapes: the grouped case, `.distinct().orderBy(enumCol)` on the plain-select path in both `column-ref` and `identifier-ref` forms, and `DISTINCT ON`. Root cause is `collectTableSources` skipping non-`table-source` FROM sources by design. Pre-existing since `wrapWithRowNumberDedup`, not introduced here. SQLite unaffected — no declaration-order enum sorting exists there. **Operator decision: own PR, sequenced before rc.5 is cut**, so no released version exposes the new route unfixed. |
| **F-3** `<pr>` placeholder in the rc.5 release note | Fixed once the PR number existed. Could not be fixed earlier — the number did not exist. |
| **F-6** post-group `skip()`-without-`take()` unpinned | Fixed. The probe correctly did not fire; the behaviour already worked because slice 1's `LIMIT -1` fix lives generically in `renderSelect`. A test now pins it. |
| **F-4** guide examples don't compile in the demo | **Not a defect.** The demo's contract uses a *named* namespace (`public`), so `db.orm.public.Post` is correct there; the guide illustrates the sole-namespace case, where `db.orm.<Model>` is right and compiles clean. Extensions were ruled out as a cause. No doc change. |
| **F-2** empty hover at the compile-error site | No action. `cursor()` behaves identically, so it is a house-level property rather than a slice regression — the third instance recorded. Per standing operator direction, QA follow-ups are not ticketed. |
| **F-5** scratch path outside the demo tsconfig | Fixed in the script itself. This was the sharpest process finding in the run: it made a **negative control pass green with the violation planted**, which converts a working gate into a false blocker. Scratch now lands in `src/scratch-qa/`, with the reason stated inline. |

**On the run's two disclosures.** The isolation deviation (one shared worktree for scenarios 1/2/4, run sequentially with per-scenario scratch and restore) was the right call — additional worktrees each need a full install and build, and all three shared one Postgres regardless. The retracted `distinct()` false alarm is recorded in the report on purpose: `tsx` does not typecheck, so a malformed call runs and no-ops, which mimics this project's exact defect signature. The next runner should expect that trap.

**On HEAD moving mid-run.** Scenarios 1/2/4 were pinned at `750b214a78` and are unaffected. Scenario 3 ran read-only against live HEAD and so reflects the docs dispatch that landed during the run — which flips its answer from the scripted "expected: no" to yes. That is the script working as designed, not staleness: it was written to be re-run after the docs landed, and it was.
