# Native Postgres enums — migration design (exhaustive)

**Status:** settled. The design of record for how a managed native enum is **represented in
SchemaIR, diffed, planned into DDL, ordered, verified, and introspected** — and how an
external (Supabase) native enum is left entirely alone. Parent: [`../spec.md`](../spec.md).
Siblings: [`authoring-design.md`](authoring-design.md), [`querying-design.md`](querying-design.md).

Grounded in the current implementation (verified on `main`); `file:line` cited inline. The
old native-enum migration machinery was **deleted** in TML-2853 (commit `b25edd8ad`); its
shapes are recovered via `git show` where they inform the reintroduction, but **nothing of it
is reclaimed** — native enums ride the generic RLS-style mechanism, no custom seams (§11).

## 0. Summary

- **Phase 1 (external / Supabase):** the type already exists; PN emits **no DDL**. The
  `external` control grade drops it from the planner's input *before* the diff runs (§7). This
  phase cuts the entire migration half — no SchemaIR node, no projection, no ops.
- **Phase 2 (managed):** PN owns the type's lifecycle through the **generic** diff → op
  pipeline that RLS policies/roles already use (§2–§6): a `PostgresNativeEnum` `DiffableNode`,
  projected into `PostgresSchemaIR`, diffed by the generic differ, planned into three DDL ops
  (`CREATE TYPE`, `DROP TYPE`, `ALTER TYPE … ADD VALUE`). **The only accepted value change is a
  pure suffix-append (`ADD VALUE`); rename, remove, and reorder are refused with a diagnostic —
  never planned** (§5).

## 1. Worked example

Managed enum added to a contract:

```prisma
native_enum UserRole { admin = "admin"  member = "member"  @@map("user_role") }
```

Diff against an empty DB → one op, ordered before the table that uses it:

```sql
CREATE TYPE "public"."user_role" AS ENUM ('admin', 'member');
```

Later, the author appends a value:

```prisma
native_enum UserRole { admin = "admin"  member = "member"  guest = "guest"  @@map("user_role") }
```

Diff → one cheap, in-place op:

```sql
ALTER TYPE "public"."user_role" ADD VALUE 'guest';
```

An **external** enum (Supabase `auth.aal_level`) in the contract produces **no** DDL at all,
in either scenario — it is dropped from the planner input (§7).

## 2. The `PostgresNativeEnum` DiffableNode (RLS template)

The generic differ works on any `DiffableNode`
([1-framework/1-core/framework-components/src/control/schema-diff.ts:22](../../../packages/1-framework/1-core/framework-components/src/control/schema-diff.ts:22)):

```ts
interface DiffableNode { readonly id: string; isEqualTo(other: DiffableNode): boolean; children(): readonly DiffableNode[]; }
```

`PostgresRole` is the leaf template — `id = this.name`, `children() = []`, `isEqualTo` = name
equality ([schema-ir/postgres-role.ts:23](../../../packages/3-targets/3-targets/postgres/src/core/schema-ir/postgres-role.ts:23));
`PostgresRlsPolicy` the same with a content-addressed name
([schema-ir/postgres-rls-policy.ts:36](../../../packages/3-targets/3-targets/postgres/src/core/schema-ir/postgres-rls-policy.ts:36)).

`PostgresNativeEnum` follows `PostgresRole` **but is not a leaf** — a native enum's *values*
must diff, so it exposes them as children:

- `id` = the type name (`user_role`, schema-qualified by namespace).
- `isEqualTo(other)` = equal **ordered** members (catches a reorder as a node-level mismatch,
  since children are id-keyed and order-insensitive — §4).
- `children()` = one child `DiffableNode` per member (ordinal-keyed), so an appended value
  surfaces as a child `missing`, and any other change surfaces as a child `extra`/`mismatch` or
  a node `mismatch`.
- carries a `control` grade (§7) — the deleted `PostgresEnumType` carried `control?:
  ControlPolicy`, unlike `PostgresRole`/`PostgresRlsPolicy` which carry none.

**Diffing is order-aware and minimal (settled).** The only accepted change is a **pure
suffix-append**: the DB's values are a prefix of the contract's, with one or more values added
at the end → `ALTER TYPE … ADD VALUE` for each. **Any other difference — rename, removal, or
reorder — is refused with a diagnostic**, never planned. This sidesteps rename-vs-add+remove
ambiguity entirely: PN does not detect renames; a changed value string simply is not a
suffix-append, so it is refused.

## 3. Contract → SchemaIR projection

`PostgresSchemaIR.children()` returns the tables
([schema-ir/postgres-schema-ir.ts:98](../../../packages/3-targets/3-targets/postgres/src/core/schema-ir/postgres-schema-ir.ts:98)),
and RLS policies enter the walked tree as table children via a `rlsPolicies` getter
(`postgres-schema-ir.ts:90`). Native enums are schema-scoped (not per-table), so they project
like **roles**: a new `enumTypes` field on `PostgresSchemaIR`, wired into `children()` at the
schema level (roles today are exposed but *not yet* in `children()` — native enums must be
wired in, the small delta from the current role state).

The projection reads the contract's `storage.namespaces[ns].entries.native_enum[name]`
entities (authoring-design.md §2.4) into `PostgresNativeEnum` nodes. Introspection supplies
the **actual** side (§10).

## 4. Diff → issues → ops

The generic `diffSchemas(expected, actual)`
([schema-diff.ts:65](../../../packages/1-framework/1-core/framework-components/src/control/schema-diff.ts:65))
aligns children by `id` and emits `missing` (in expected, not actual), `extra` (in actual, not
expected), and node `mismatch` (present both sides, `isEqualTo` false). `diffPostgresSchema`
([core/migrations/diff-postgres-schema.ts:25](../../../packages/3-targets/3-targets/postgres/src/core/migrations/diff-postgres-schema.ts:25))
runs it and filters to the target's node kinds; `planPostgresSchemaDiff`
([core/migrations/planner.ts:266](../../../packages/3-targets/3-targets/postgres/src/core/migrations/planner.ts:266))
turns issues into op-factory calls (today: policy `missing` → `CreatePostgresRlsPolicyCall`,
`extra` + `allowsDestructive` → `DropPostgresRlsPolicyCall`).

Native-enum mapping (added to `planPostgresSchemaDiff`):

| Diff issue | Meaning | Op |
| --- | --- | --- |
| node `missing` | type in contract, not DB | **`CREATE TYPE … AS ENUM (values)`** |
| node `extra` (+destructive) | type in DB, not contract | **`DROP TYPE`** |
| pure suffix-append (DB values are a prefix of the contract's) | value(s) appended | **`ALTER TYPE … ADD VALUE`** for each (cheap, in-place) |
| any other value difference (rename, removal, reorder) | — | **refused** with a diagnostic — never an op |

The refusal is the project's core constraint (`../spec.md` "Why native enums are awkward"):
only a pure suffix-append is cheap and unambiguous. Removal and reorder force a full-table
rewrite; rename is skipped to keep diffing order-aware and free of rename-vs-add+remove
ambiguity. All three are refused.

## 5. The DDL ops

Enum DDL strings are necessarily enum-specific, but they are emitted through the **generic**
op-factory-call + DDL-node mechanism (the RLS path — `operations/rls.ts:20` builds a
`PostgresCreatePolicy` node via `createPolicy` and lowers it through the adapter's
`lowerToExecuteRequest`, [core/ddl/nodes.ts:160](../../../packages/3-targets/3-targets/postgres/src/core/ddl/nodes.ts:160),
[contract-free/ddl.ts:85](../../../packages/3-targets/3-targets/postgres/src/contract-free/ddl.ts:85)),
**not** a bespoke planner path. The three ops mirror the deleted `operations/enums.ts` shapes
(recovered from `b25edd8ad~1`, minus `RENAME VALUE`), reintroduced through the current op
machinery:

- **create** — `CREATE TYPE <qual> AS ENUM (<values in declaration order>)`; values from the
  entity's ordered members.
- **delete** — `DROP TYPE <qual>`.
- **add value** — `ALTER TYPE <qual> ADD VALUE '<value>'`. Cheap, no rewrite. **Caveat:**
  `ADD VALUE` cannot be used in the same transaction that first makes the value usable — this
  breaks the single-transaction migration guarantee, so the runner surfaces it (the op is its
  own statement, and the caveat is documented to the runner, per `../spec.md` #4).
Rename, remove, and reorder have **no op** — they are refused at the planner (§4), never
lowered (only a pure suffix-append is accepted).

## 6. Ordering — type before column

Two existing ordering mechanisms already place type creation ahead of the tables/columns that
use it, so no new ordering logic is needed:

- **Issue-kind order** — `ISSUE_KIND_ORDER`
  ([core/migrations/issue-planner.ts:74](../../../packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts:74))
  ranks `type_missing: 2` and `type_values_mismatch: 3` **before** `missing_table: 20` and
  `missing_column: 30`.
- **Call category** — `classifyCall` routes calls whose lifted op has
  `target.details.objectType === 'type'` into the **`dep`** bucket (`issue-planner.ts:750`),
  emitted first in the final assembly (`issue-planner.ts:957`: `dep → drop → table → column →
  …`), alongside `createSchema`/`createExtension`.

A native-enum create is a `type`/`dep` op, so it lands ahead of the table that references it.
(The `type_*` ordering keys are **live generic infrastructure**, verified in use by the current
planner/verifier — not residue — so native-enum type ordering reuses them directly; see §11.)

## 7. Control grade — external Supabase enums emit no DDL

`ControlPolicy = 'managed' | 'tolerated' | 'external' | 'observed'`
([1-framework/0-foundation/contract/src/control-policy.ts:10](../../../packages/1-framework/0-foundation/contract/src/control-policy.ts:10));
`effectiveControlPolicy(node, default) → 'managed'` when unset (`control-policy.ts:20`).
`callAllowedUnderControlPolicy` returns **false** for `external`/`observed`
([2-sql/9-family/src/core/migrations/control-policy.ts:59](../../../packages/2-sql/9-family/src/core/migrations/control-policy.ts:59)).
Crucially, `partitionIssuesByControlPolicy` drops `external`/`observed` subjects from the
planner's **input** — before the diff engine ever sees them
(`control-policy.ts:208`, wired at [postgres/…/planner.ts:176](../../../packages/3-targets/3-targets/postgres/src/core/migrations/planner.ts:176)):
*"external / observed subjects … are dropped from the planner's input entirely; the planner
never observes them, never diffs them, never generates DDL for them."*

Native enums plug straight in: the `PostgresNativeEnum` carries `control` (§2), and the
control-policy subject resolver
([postgres/…/migrations/control-policy.ts:187](../../../packages/3-targets/3-targets/postgres/src/core/migrations/control-policy.ts:187),
which today reads `table?.control`) is extended to read the enum node's grade. Supabase's
extension sets `external` as its default, so its contributed enums are dropped from the input
and never migrated — even after phase 2 lands. **This is the entire phase-1 story: no new
suppression logic, just the grade.**

## 8. `storageHash`

`storageHash = sha256(canonicalize({ schemaVersion, targetFamily, target, storage }))` — the
`storage` section, `domain` excluded (ADR 004;
[1-framework/0-foundation/contract/src/hashing.ts:82](../../../packages/1-framework/0-foundation/contract/src/hashing.ts:82),
`hashContract` at `hashing.ts:50`, which preserves the full `storage.namespaces[...].entries`
tree). A `native_enum` entity lives at `storage.namespaces[ns].entries.native_enum[name]`
(authoring-design.md §2.4), so it **is** part of `storageHash` — its members are part of the
migration identity (ADR 199). This is why the permitted values live in storage, not domain
(`../spec.md` "Why the native_enum entity lives in storage"): the planner derives the expected
type from storage alone, with no `domain` reference.

External enums are recorded in `storage.entries` too (so columns can reference them, casts can
name them, `db.nativeEnums` can read them) and therefore feed `storageHash` — but they are
stable (their definition is whatever Supabase ships), so they do not churn the hash, and their
`external` grade means the hash change never yields DDL.

## 9. Verify and the planner share one diff

Verification and planning run the **same** shared diff functions — the planner to *build* ops,
verify to *reject* on any non-empty result:

- `diffPostgresSchema` (the `DiffableNode` differ, §4) is called by the planner
  (`planner.ts:266`) and by the verify adapter hook `collectSchemaDiffIssues`
  ([adapter-postgres/…/control-adapter.ts:131](../../../packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts:131),
  invoked from [2-sql/9-family/…/control-instance.ts:705](../../../packages/2-sql/9-family/src/core/control-instance.ts:705)),
  which folds the issues into the verify result and counts them as failures when non-empty.
- The relational verifier `verifySqlSchema`
  ([2-sql/9-family/src/core/schema-verify/verify-sql-schema.ts:105](../../../packages/2-sql/9-family/src/core/schema-verify/verify-sql-schema.ts:105))
  is called by the planner's private `collectSchemaIssues` (`planner.ts:338`) and by
  `verifySchema` (`control-instance.ts:696`), and again post-apply by the runner
  ([postgres/…/migrations/runner.ts:137](../../../packages/3-targets/3-targets/postgres/src/core/migrations/runner.ts:137)).

Native enums ride `diffPostgresSchema` exactly like RLS: the same missing/extra/mismatch the
planner turns into ops, verify treats as drift and rejects. No separate native-enum verify
path. (For managed enums, this gives R10 — the differ reports missing / extra / value mismatch
against the live DB.)

## 10. Introspection (adoption / porting)

The live-DB (actual) side comes from introspection. A **names-only** `pg_type WHERE typtype =
'e'` query is insufficient — the diff needs **ordered values**, so introspection is enriched to
read `pg_enum.enumsortorder` per type. On adoption, contract-infer **emits a `native_enum`
block instead of throwing** — replacing the current rejection: the error prose *"Native
Postgres enums (CREATE TYPE … AS ENUM) are not adoptable by contract infer"*
([2-sql/9-family/src/core/psl-contract-infer/sql-schema-ir-to-psl-ast.ts:87](../../../packages/2-sql/9-family/src/core/psl-contract-infer/sql-schema-ir-to-psl-ast.ts:87))
and the integration test that asserts it are current correct behavior **until adoption ships
(the deferred managed phase)** (do not delete them pre-emptively — §11). Adopted enums are
graded **`managed`** — all inference is managed; there is no observe-only adoption.

## 11. Residue to DELETE — no custom seams

The point of the RLS-style generic mechanism is that a new entity needs **no bespoke
plumbing**. The dead residue of the removed TML-2853 native enum is **deleted, not
reclaimed** — verified to be exactly one file:

- **`packages/3-targets/3-targets/postgres/src/core/postgres-enum-type-schema.ts`** — the
  `PostgresEnumTypeSchema` arktype validator (`kind: 'postgres-enum'`, `values`, `control?`).
  Its docstring claims it is "registered against the 'type' entries key," but **no
  registration call exists** anywhere; it is unimported dead code. **Deleted.** The phase-2
  entity's validator is contributed fresh through the generic `postgresAuthoringEntityTypes`
  path (authoring-design.md §2.3), not this file.

The `ISSUE_KIND_ORDER` keys `type_missing` / `type_values_mismatch` / `enum_values_changed`
were checked and are **live generic infrastructure, not residue** — actively used by the
planner's `mapIssueToCall`, the `isMissing` predicate, and the shared `SchemaIssue` union
(`EnumValuesChangedIssue`, produced by the SQL-family verifier). Native-enum type diffing
reuses them (§6); they are **kept**.

**Do not** touch live behavior: the contract-infer native-enum rejection test + message (§10)
are current correct behavior and are replaced *by phase 1*, not deleted now.

## 12. What is new vs reused (migration path)

**New:** the `PostgresNativeEnum` node + its `enumTypes` projection into `PostgresSchemaIR`
wired into `children()`; the three enum DDL ops; the enum-node branch in `planPostgresSchemaDiff`
(create/drop/add-value, order-aware; rename/remove/reorder refused); enriched
`pg_enum.enumsortorder` introspection + contract-infer emission (managed).

**Reused:** the generic `DiffableNode` differ; `diffPostgresSchema`; the op-factory-call + DDL
node + lowerer emission path; the `dep`/`type` ordering buckets; the `ControlPolicy`
partitioning (external → no DDL); `storageHash`; the shared planner/verify diff. No custom
seams; no reclaimed residue.

## 13. Phasing

- **MVP (external).** Cuts everything in this doc — no SchemaIR node, no projection, no ops.
  Ships only the `native_enum` contract representation graded `external` (authoring-design.md
  §2); `storageHash` records it (§8), and since native enums are never diffed in the MVP,
  `db verify` emits nothing for them for free. Representation + typing only
  (see [`../plan.md`](../plan.md)).
- **Deferred (managed, separate project).** Adds the `PostgresNativeEnum` node (§2), the
  projection (§3), the order-aware diff integration (§4), the three DDL ops (§5), managed verify
  (§9), and adoption (§10, emitting a `managed` enum). Rename/remove/reorder refused (§4).
  Parallel-safe with TML-2952/2953. May never be built — do not start without a fresh triage.

## 14. Open questions

None. Diffing is order-aware, suffix-append-only (§2/§4); rename/remove/reorder refused;
adopted enums are `managed` (§10 — all inference is managed).
