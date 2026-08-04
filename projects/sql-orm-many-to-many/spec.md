# SQL ORM — Many-to-Many End to End

> Linear Project: [SQL ORM: Many-to-Many End to End](https://linear.app/prisma-company/project/sql-orm-many-to-many-end-to-end-c178df40ca3a) · Planning record: TML-2597 (`Plan: …`) · Slices: TML-2784…2787 · Branch: `tml-2597-sql-orm-complete-end-to-end-many-to-many-support-include`

## Purpose

Many-to-many is the most-asked-about gap for users migrating from Prisma's relation API. This project exists so that M:N relations are **first-class in the ORM client** — readable, filterable, and writable through their junction — rather than something users must hand-wire as explicit junction models and that downstream integrations (the Pothos plugin) must reject at schema-build time. The relation-shaped API *is* the product promise; M:N is the hole in it.

## At a glance

Authoring already works — `rel.manyToMany('Tag', { through: 'UserTag', from: 'userId', to: 'tagId' })` lowers to a `RelationNode` with a fully populated `through`. The runtime ORM is where it falls apart.

**Today** the relation-shaped API is unavailable for M:N at every step:

```ts
db.orm.User.include('tags')                          // ✗ resolver reads on.localFields only; ignores `through`
db.orm.User.filter((u) => u.tags.some(/* … */))      // ✗ EXISTS skips the junction → wrong shape
db.orm.User.create({ tags: (t) => t.connect({ id }) }) // ✗ throws "M:N nested mutations are not supported yet"
```

…and, discovered while shaping this project: **an emitted M:N contract does not even validate.** `validateContract` rejects it two ways — `cardinality: 'N:M'` isn't in the relation validator's enum, and `through` is an undeclared key on a reject-policy object. So there is no validatable end-to-end M:N contract at all, which is *why* downstream integrations route users to explicit junction models.

**After this project:**

```ts
db.orm.User.include('tags')                          // → { …user, tags: Tag[] }  (one correlated query through the junction)
db.orm.User.filter((u) => u.tags.some((t) => t.name.eq('x'))) // → EXISTS walking the junction
db.orm.User.update({ tags: (t) => t.connect({ id }) })        // → junction INSERT
db.orm.User.update({ tags: (t) => t.disconnect({ id }) })     // → junction DELETE
```

The whole project hangs off one new primitive: a uniform **`through` descriptor** on the resolved relation (`parent → junction → target`), surfaced once by the single shared resolver and consumed three ways — correlated read, EXISTS filter, junction-DML write.

## Non-goals

- **New nested-write kinds.** `update` / `updateMany` / `upsert` / `delete` / `set` / `connectOrCreate` on related rows do not exist for *any* cardinality today and are **out of scope** — tracked separately in [TML-2781](https://linear.app/prisma-company/issue/TML-2781). This project ships only the three kinds that exist: `create` / `connect` / `disconnect`.
- **Junction payload columns through the M:N sugar.** Reading or writing non-FK columns on the junction table is served by the junction model's own 1:N relations + the SQL query builder. The M:N sugar deliberately does not expose them.
- **Auto-synthesised junction models.** `through` must reference an authored model (lowering throws otherwise); this project does not generate implicit junctions.
- **LATERAL / multi-query read strategies.** Removed by TML-2729 / TML-2657; the read path is correlated-only and stays that way.
- **Wiring the Pothos plugin itself.** This project makes the runtime M:N API shape match what the plugin needs (`{ connect: { id } }` / `{ disconnect: { id } }`); the plugin-side wiring is downstream.

## Follow-on scope (expanded 2026-06-02)

After the runtime core (slices 0–3) shipped, scope expanded to **demonstrate the M:N API end-to-end in the example apps** — and that surfaced a real authoring-surface gap. These are slices 4–6 (see the plan):

- **Demo examples** (previously implicit, now explicit scope). The SQLite demo (`examples/prisma-8-demo-sqlite`, TS-authored) demonstrates include / filter / nested-write M:N — **done** (slice 4 / TML-2790).
- **PSL many-to-many authoring** (newly in scope — slice 5 / TML-2794). The navigable M:N API is authorable **only via the TS contract builder** (`rel.manyToMany`); PSL emits only `1:N`/`N:1` and routes M:N to explicit junction models. Teaching PSL to lower a junction to `cardinality:'N:M'` + `through` completes the authoring surface. _(Framework-scoped — may be promoted to its own project at pickup.)_
- **PG demo examples + dual-mode reconciliation** (slice 6 / TML-2795, **blocked by slice 5**). The PG demo emits from PSL, so it can't show M:N until slice 5 lands; it also carries pre-existing dual-mode contract drift (stale TS source) to reconcile.

_Note: the original Non-goal "auto-synthesised junction models" still holds for the **TS** builder; slice 5's PSL implicit-list support (if pursued) is a PSL-authoring convenience, not auto-synthesis in the runtime contract._

## Place in the larger world

- **sql-orm-client** (`packages/3-extensions/sql-orm-client`) is an optional extension over the SQL contract + query lane — ADR 015 (ORM as Optional Extension).
- **Contract surface.** The `through` extension lives in the SQL domain relation format — ADR 172 (Contract domain-storage separation) and ADR 121 (Contract.d.ts structure and relation typing) constrain its shape. The cast at `build-contract.ts` flagged "until the contract type is extended to cover many-to-many" is the seam this project closes.
- **Builds on** the correlated-only read path (TML-2729) and the single-query mutation read-back (TML-2657) — there is no LATERAL or multi-query fallback to extend.
- **Primary downstream consumer:** the Pothos plugin, which today rejects M:N at schema build. The runtime callback shapes must match what plugin-prisma users expect so the plugin can do the obvious wiring.

## Cross-cutting requirements

- **An M:N contract must emit and round-trip through `validateContract`.** This is the foundation every slice's integration fixture depends on — no validatable M:N contract exists today. (System-level because it's a prerequisite shared by all three consumer slices, not owned by any one of them.)
- **The junction-walk is a single shared primitive.** The `through` descriptor is surfaced once, through the one `resolveModelRelations` → `ResolvedRelation` resolver that already feeds includes, filters, and mutations. Slices consume it differently but must not fork the resolution.
- **Cardinality tag canonicalised on `'N:M'` repo-wide.** The contract, schema, PSL, and lowering already use `'N:M'`; the orm-client's lone `'M:N'` spelling is reconciled to it (not translated at a boundary). No `'M:N'`/`'N:M'` split survives.
- **Integration-test standard for every user-observable M:N path (read, filter, write).** Tests run against the existing sql-orm-client integration harness (PGlite via `withCollectionRuntime`; cover SQLite too only if the harness already supports it — do not build new SQLite infra). They (a) assert on the **whole returned row** via `.toEqual()` / snapshot — never cherry-pick individual fields; (b) use **explicit `.select(...)` projections in most tests** so adding a model field doesn't churn assertions; and (c) include **some tests exercising implicit (default) selection** for nested M:N reads, verifying the full default shape returns without an explicit select. The integration fixture has no M:N relation today — the read slice adds one (e.g. User↔Tag via a junction) to the fixture source + re-emits; later slices reuse it.
- **Every merged slice leaves non-M:N paths green and the system deployable.** M:N support arrives incrementally; partial support must never regress existing cardinalities.

## Transitional-shape constraints

- **Slice 0 is a contract-shape change (hash change).** From slice 0 onward, emitted fixtures/goldens carry `through` + `N:M`; `pnpm fixtures:check` must be green at every slice boundary, and unrelated fixture drift is investigated, not committed.
- **The change is purely additive to the contract** — existing non-M:N contracts are unchanged, so no deprecation window is required; but each slice must keep CI green on the project working branch before the next builds on it.

## Project Definition of Done

Inherits the team-DoD floor ([`drive/calibration/dod.md`](../../drive/calibration/dod.md)) — not restated here. Project-specific conditions on top:

- [ ] An M:N contract (`rel.manyToMany` with `through`) emits and round-trips `validateContract` (fails today).
- [ ] `db.orm.User.include('tags')` returns `{ …user, tags: Tag[] }` in a **single** SQL execution (one correlated subquery through the junction, no LATERAL) — PG + SQLite integration tests.
- [ ] `.filter((u) => u.tags.some/every/none(...))` emits an EXISTS that walks the junction — PG + SQLite.
- [ ] Nested `connect` / `disconnect` / `create` over M:N route to junction INSERT / DELETE, under both `create()` and `update()` parent flows; the `partitionByOwnership()` "not supported yet" guard is removed and its unit test flips to a positive assertion.
- [ ] Nested `.create` over a **required-payload junction** (junction with required non-FK columns) is disabled **at types AND at runtime**, with a message pointing to the junction model's 1:N relations / the SQL builder. (No-required-payload junctions allow ergonomic nested `create`.)
- [ ] The runtime M:N callback shape matches what the Pothos plugin needs (`{ connect: { id } }` / `{ disconnect: { id } }`).
- [ ] ADR for the `through` relation contract extension authored or ADR 121 amended (see ADR pointer).

_Follow-on (slices 4–6):_

- [x] **SQLite demo** demonstrates the M:N API (include / filter / nested write) end-to-end (slice 4 / TML-2790).
- [ ] **PSL authors M:N** — a PSL junction lowers to `cardinality:'N:M'` + `through`, with ORM-API parity to TS-authored contracts (slice 5 / TML-2794). _(May be promoted to its own project.)_
- [ ] **PG demo** demonstrates the M:N API and its dual-mode contract sources are reconciled (`test:dual-mode` green) (slice 6 / TML-2795; blocked by slice 5).

## Contract-impact

_Required: this project changes the contract surface._

- **Entities affected:** the SQL domain relation — the `ModelRelation` JSON schema (`data-contract-sql-v1.json`), the `ContractReferenceRelation` arktype validator (`packages/2-sql/1-core/contract`), and the corresponding `ContractReferenceRelation` TS type (`@internal/sql-contract/types`).
- **New / changed kinds:** relation `cardinality` enum gains `'N:M'`; relation gains optional `through: { table, parentColumns, childColumns }` (canonical field names match lowering; `build-contract`'s `parentCols/childCols` drift is reconciled). The `as ContractRelation['cardinality']` cast in `build-contract.ts` is deleted.
- **Migration plan for downstream consumers:** purely **additive** — existing non-M:N contracts are byte-unchanged in shape, so no consumer breaks and no deprecation window is needed. The contract **hash** changes, so all emitted fixtures/goldens regenerate; `pnpm fixtures:check` gates this. `validateContract` consumers gain M:N acceptance (today they reject it), so this only widens what validates.

## Adapter-impact

_Required: confirm target-adapter reach._

- **No adapter code changes** (`packages/3-targets/**` untouched). The work is in the contract + the sql-orm-client extension; SQL is produced by the existing renderer/query lane.
- **postgres + sqlite** must execute the new shapes: correlated junction subquery (read), EXISTS-through-junction (filter), junction INSERT/DELETE (write). Both are covered by integration tests (PGlite + SQLite).
- **mongo:** N/A — SQL ORM only.

## ADR pointer

The `through` extension to the relation contract is a durable contract-surface change. Working position: **amend ADR 121** (Contract.d.ts structure and relation typing) to cover the M:N relation shape (`through` + `N:M` cardinality), cross-referencing ADR 172. Confirm at close-out whether an amendment suffices or a standalone ADR is warranted (per the ADR-audit DoD item).

## Open Questions

1. **Cardinality canonicalisation blast radius.** Canonicalising on `'N:M'` touches the orm-client's `RelationCardinalityTag`. Working position: it's contained to sql-orm-client; slice 0 greps for any other `'M:N'` hardcode and reconciles or documents it.

_Resolved during shaping (2026-06-01): project slug is `sql-orm-many-to-many`; promoted to a dedicated Linear Project ([SQL ORM: Many-to-Many End to End](https://linear.app/prisma-company/project/sql-orm-many-to-many-end-to-end-c178df40ca3a)) — TML-2597 became the `Plan: …` record (Done); four slice issues TML-2784…2787 carry the work._

## References

- Linear Project: [SQL ORM: Many-to-Many End to End](https://linear.app/prisma-company/project/sql-orm-many-to-many-end-to-end-c178df40ca3a) · planning record TML-2597 · slices TML-2784 (0) / TML-2785 (1) / TML-2786 (2) / TML-2787 (3)
- Related / deferred: [TML-2781](https://linear.app/prisma-company/issue/TML-2781) (new nested-write kinds), [TML-2729](https://linear.app/prisma-company/issue/TML-2729) (correlated-only reads), [TML-2657](https://linear.app/prisma-company/issue/TML-2657) (single-query mutation read-back)
- ADRs: ADR 015 (ORM as Optional Extension), ADR 121 (Contract.d.ts structure and relation typing), ADR 172 (Contract domain-storage separation)
- Design-discussion record: this session (`drive-discussion`, 2026-06-01) — Option A representation, 4-slice shape, write scope + required-payload guard
