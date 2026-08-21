# aggregate-pagination

## Purpose

An ORM aggregate must answer the question the chain actually describes. Today `.take(10).aggregate(…)` silently reduces over every matching row, so the caller receives a confident, wrong number with no signal that the window they asked for was discarded. This project makes the row scope a chain expresses the row scope the aggregate reduces.

## At a glance

Chain **position** decides what pagination scopes — the builder disambiguates what Prisma's flat options object cannot express:

```typescript
// Pagination BEFORE groupBy → scope the rows, then group them
await db.orm.Post.orderBy((p) => p.views.desc()).take(10).groupBy('userId')
  .aggregate((agg) => ({ total: agg.sum('views') }));
// SELECT user_id, sum(views) FROM (SELECT … ORDER BY views DESC LIMIT 10) posts__scoped GROUP BY user_id

// Pagination AFTER groupBy → page the groups themselves
await db.orm.Post.groupBy('userId').orderBy(…).take(10)
  .aggregate((agg) => ({ total: agg.sum('views') }));
// SELECT user_id, sum(views) FROM posts GROUP BY user_id ORDER BY … LIMIT 10

// Root aggregate, no grouping → scope the rows, then reduce
await db.orm.Post.orderBy((p) => p.views.desc()).take(10)
  .aggregate((agg) => ({ total: agg.sum('views') }));
// SELECT sum(views) FROM (SELECT views FROM posts ORDER BY views DESC LIMIT 10) posts__scoped
```

Each shape already exists somewhere in the tree. The row-scoping wrap is what `include('posts', (p) => p.skip(5).take(10).count())` compiles to today (`packages/3-extensions/sql-orm-client/src/query-plan-select.ts:1235-1370`, tested at `test/query-plan-select.test.ts:504`). Group-level paging is `SelectAst.withLimit` / `withOffset` (`packages/2-sql/4-lanes/relational-core/src/ast/types.ts:1691-1698`) applied to the select `compileGroupedAggregate` already builds. Neither shape is new; both are unreachable from the root chain.

**Nothing is banned.** An earlier route — making pagination a type + runtime error on aggregates — was considered and rejected: position-based semantics makes both readings well-defined, and Prisma ships both (row-scoping on `aggregate`, group-paging on `groupBy`), so a ban would remove a capability the predecessor product has.

## Non-goals

- **Cursor pagination on the grouped collection.** `cursor()` stays a pre-group operation. Prisma does not offer a cursor on `groupBy`, and a lexicographic boundary over group keys is a separate design.
- **Mongo ORM parity.** `packages/2-mongo-family/5-query-builders/orm/src/collection.ts:104-161` declares `take` / `skip` but no `aggregate()` / `groupBy()` terminal at all — there is nothing to fix document-side. ADR 175's shared-surface goal means the semantics pinned here become the contract a future Mongo terminal honours; delivering it is not this project.
- **Banning or erroring on any currently-accepted chain.** Explicitly rejected; see § At a glance.
- **Reworking the nested scalar-refine path.** It is correct today. This project may extract helpers out of it, but must not change what it emits.
- **Ordering groups by an aggregate alias.** Prisma allows `orderBy: { _sum: { … } }`; this project ships key-only ordering on the grouped collection. Aggregate-alias ordering needs a new builder surface over the aliases, is additive on top of what ships here, and is the single largest cost driver if pulled in.
- **`select()` in aggregate position, and other already-inert dropped clauses.** Dropping a clause that cannot change the answer stays the house style (`test/query-plan-select.test.ts:486`). Only clauses that change the answer are in scope — which is why `distinct` / `distinctOn` **are** in scope and `select()` is not.

## Place in the larger world

**Owning package.** `packages/3-extensions/sql-orm-client` — `collection.ts` (`aggregate()` at `:1103`, `groupBy()` at `:750`, `take`/`skip` at `:955`/`:970`, `cursor()` at `:862`), `grouped-collection.ts`, `query-plan-aggregate.ts`, and the helper source `query-plan-select.ts`.

**ADR 201 — State-machine pattern for typed DSL builders.** Constrains the shape and endorses it: `GroupedCollection` is already a distinct class with its own vocabulary, so adding `take`/`skip`/`orderBy` there is "the state's own menu of methods" rather than a new mechanism. The pre-group/post-group distinction is a state transition, exactly the pattern ADR 201 records.

**ADR 175 — Shared ORM Collection interface.** Establishes that the SQL and Mongo ORM surfaces are meant to chain identically. Relevant as a forward constraint, not as work here.

**Prisma prior art.** `aggregate()` takes `where` / `orderBy` / `cursor` / `take` / `skip` and scopes the rows reduced; `groupBy()` takes `take` / `skip` and pages the groups, requiring `orderBy` alongside them. This project matches both and, because position disambiguates, ends up strictly more expressive than the flat-object form.

**Contract impact: none.** No entity kinds, capabilities, or emitted types change; nothing under `packages/0-shared/contract/**` or `packages/1-framework-core/**` is touched.

**Adapter impact: no new shapes; one conditional renderer correction.** The work emits plain relational AST (derived table, `LIMIT`/`OFFSET`, and — if `distinct` is folded in — the existing portable `ROW_NUMBER` lowering). No adapter learns a new shape and `.agents/rules/no-target-branches.mdc` holds. Postgres and SQLite are both exercised through integration tests because the renderers differ in parameter binding, not because the plan differs.

**Amended 2026-08-17 (operator-authorised).** An adversarial review of the root-pagination slice predicted that SQLite cannot parse the `OFFSET`-without-`LIMIT` this project's `skip`-without-`take` requirement produces: SQLite's grammar is `LIMIT expr [OFFSET expr]` with no standalone `OFFSET`, while the adapter renders the two as independently-omittable clauses. The defect is pre-existing — `.skip(5).all()` is affected identically — but this project is what makes it a named DoD item on both targets. The operator's decision: **confirm it empirically in the integration dispatch, and if confirmed, correct the renderer within this project** rather than closing the DoD item on one target. The correction (emit `LIMIT -1 OFFSET n` when offset is present and limit absent) is a renderer bug fix, not a branch on target, so the no-target-branches rule still holds. Shipping a DoD item that says "skip without take works" while it errors on a supported target would be a checked box over a broken behaviour — the exact failure mode this project exists to close.

## Cross-cutting requirements

- **An unpaginated aggregate compiles byte-identically to today.** The conditional wrap is what satisfies this; an unconditional derived table that "the planner optimises away" does not. This is a hard constraint, not a preference, and it applies to every slice that touches plan construction.
- **The nested scalar-refine path emits exactly what it emits today.** Helper extraction is a pure refactor; any diff in its compiled output is a defect.
- **Position semantics are uniform.** Pre-group pagination scopes rows and post-group pagination pages groups, in every combination, including with `having()` and `where()` present. A chain that reads one way in one combination and another way in another is a failure of the project, not of a slice.
- **Parameter binding stays correct across the derived-table boundary.** `collectOrderedParamRefs` dedupes by `ParamRef` identity while the SQLite renderer deliberately does not (`packages/2-sql/4-lanes/relational-core/src/ast/util.ts:13-32`); a wrap that lets one `ParamRef` reach SQL twice desyncs `$N` / `?` binding. Every slice emitting a wrap carries a per-target test.

  **Refined 2026-08-18, on evidence from the integration dispatch.** The requirement stands; the failure mechanism named above is narrower than stated, and a slice should know which of its tests can actually prove what. Both renderers were traced: on Postgres, `renderParamRef` resolves every `ParamRef` through an index map built from the *same deduped* walk, so a duplicated instance renders as the same `$N` at both sites and binds identically — the desync is benign there by the renderer's own design. On SQLite, `renderLoweredSql` builds off the raw, non-deduped `ast.collectParamRefs()` for both the `?` placeholders and the params array, self-consistent by construction, and `SqlRuntimeBase` executes with that renderer-owned `lowered.params` rather than the deduped `plan.params`. So the desync as described requires `plan.params` to be what gets bound, and on the execution path it is not. The practical consequence: a *value* assertion on SQLite is load-bearing evidence for this property, because corruption there has no silent-and-correct-looking failure mode; a params assertion on Postgres tests something real but different (rebinding producing a duplicate object for one value). Keep the per-target test requirement — this refines what each target's test is evidence *of*.

## Transitional-shape constraints

- **Helper extraction lands as its own change with no behaviour delta.** Moving `buildStateWhere`, `wrapWithRowNumberDedup`, `createTableRefRemapper`, and the cursor lowering out of `query-plan-select.ts` is separable from every behaviour change and should not be entangled with one.
- **`test/aggregate-pagination.test.ts` is never flipped from `it.fails` to `it` as-is.** Its assertions target the top-level AST (`ast.limit`), where a correct fix puts `undefined` — the limit belongs to the derived table. Under a correct implementation those assertions stay red. The slice that implements root `aggregate()` rewrites them against the derived-table shape.
- **Pre-group and post-group pagination ship together, or post-group ships first.** A user migrating from Prisma writes `.take(10).groupBy('x')` expecting group-paging. Shipping row-scoping while the correct form does not yet exist relocates the silent-wrong-answer bug instead of closing it.
- **Every slice keeps CI green on `main`.** Standard; called out because the middle slices change compiled SQL.

## Project Definition of Done

- [ ] Team-DoD floor items (inherited from [`drive/calibration/dod.md`](../../drive/calibration/dod.md)).
- [ ] Root `.aggregate()` honours `take` / `skip` / `cursor`, scoping the rows reduced — including `skip` without a paired `take` ("reduce all but the first n"), which is well-defined under row-scoping.
- [ ] Root `.aggregate()` honours `distinct()` / `distinctOn()`, reusing the portable `ROW_NUMBER` lowering (`wrapWithRowNumberDedup`) the nested path already proves at `test/query-plan-select.test.ts:545`.
- [ ] `.take()/.skip()` before `groupBy()` scope the grouped rows; `.take()/.skip()` after `groupBy()` page the groups; both verified with `having()` present.
- [ ] Post-group `take` / `skip` require a prior `orderBy` on the grouped collection, gated in the type state the way `cursor()` gates on `hasOrderBy` (`collection.ts:862-866`) — unordered group paging is non-deterministic and Prisma requires the same.
- [ ] A CI-enforced guard proves an unpaginated aggregate's compiled AST is unchanged from today — a review-time eyeball does not satisfy this.
- [ ] Integration tests assert values (not just SQL shape) on both PGlite and SQLite for each chain position.
- [ ] `test/aggregate-pagination.test.ts` no longer contains `it.fails`, and its assertions target the derived-table shape.
- [ ] The position-semantics rule is documented where a user meets it — TSDoc on `aggregate` / `groupBy` / `take` / `skip`, plus a release note flagging the behaviour change for anyone who wrote the previously-ignored form. It lands in user-facing ORM docs, **not** an ADR: position-determines-scope is an application of ADR 201, not a new decision.

  **Split 2026-08-20, on operator direction.** This item bundles two deliverables in different states, and closing it as one box would misreport both.

  The **TSDoc half is refused, deliberately.** The operator reviewed the comments this project added and had them deleted as stating what the signatures already say, with a standing instruction to trim aggressively. That instruction outranks this DoD item, which was drafted before the comments existed to be judged. The item is unsatisfied **by choice**, not by oversight, and should not be reopened by a later reader who reads an unchecked box as an omission. If position semantics need prose, the place is the ORM docs below — where a user reads before writing the chain — not a hover tooltip they see only after.

  The **docs + release-note half remains genuinely outstanding.** No slice delivered it; both slices were behaviour. It is the last un-owned work in the project and needs either a closing dispatch or an explicit operator deferral before `drive-close-project` can run.
- [ ] No new ORM error subcode was added (the no-ban decision held).

## Open Questions

None. The five questions this spec was drafted with were resolved by the operator on 2026-08-17, each confirming the drafted working position: `distinct` / `distinctOn` folded in; aggregate-alias ordering out of scope; `orderBy` required alongside post-group pagination; `skip` without `take` allowed; no new ADR. Each now lives in the section that owns it — non-goals, Project-DoD — rather than here.

The ADR question is revisitable at close-out per the repo's ADR cadence, if the project turns out to have produced a decision larger than an application of ADR 201.

## References

- Linear Project: _not yet created — project-DoR item, needs operator_
- ADRs: [ADR 201 — State-machine pattern for typed DSL builders](../../docs/architecture%20docs/adrs/ADR%20201%20-%20State-machine%20pattern%20for%20typed%20DSL%20builders.md); [ADR 175 — Shared ORM Collection interface](../../docs/architecture%20docs/adrs/ADR%20175%20-%20Shared%20ORM%20Collection%20interface.md)
- Prior art in-tree: `packages/3-extensions/sql-orm-client/src/query-plan-select.ts:1235-1370` (the working row-scoping wrap); `test/query-plan-select.test.ts:504` (its test)
- Prisma prior art: [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference); [Aggregation, grouping, and summarizing](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing)
- Design-discussion record: two-agent estimation + debate (fix vs. ban), 2026-08-17 — settled on position-disambiguated full support; no durable artifact beyond this spec
