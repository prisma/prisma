# Slice — `managed-native-enum-add-value` (Phase 2, Slice B)

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) · **Requirements:** R8 (a pure suffix-append migrates in place via `ADD VALUE`, no rewrite), R9 (rename / remove / reorder is refused with a diagnostic, never planned), R5 preserved (external enums: no DDL, no drift). Design of record: project spec § Phase 2 + [`../../specs/migration-design.md`](../../specs/migration-design.md) §4–§5. Closes out Phase 2.

## At a glance

The contract appends a member to a managed enum:

```prisma
native_enum UserRole {
  user
  admin
  guest   // ← new
}
```

`migration plan` today emits the Slice-A named diagnostic ("enum value changes are not auto-migrated yet"). After this slice it plans:

```sql
ALTER TYPE "public"."user_role" ADD VALUE 'guest';
```

— one op per appended value, in declaration order, applied in place with no table rewrite. Any other member change — a rename, a removal, a reorder — is **refused** with a diagnostic naming the class and the manual path (`migration new`); it is never lowered to an op.

**Why now:** Slice A (PR #949) shipped the managed create/delete lifecycle and deliberately punted the value-mismatch case to a named diagnostic. This slice replaces that diagnostic with the real semantics, closing the last Phase-2 requirement pair (R8/R9). Not on the Supabase critical path (operator ruling): Supabase enums are external, and external drift stays suppressed.

## Chosen design

**1. Suffix-append classification, in the existing `not-equal` lowering.** `mapNativeEnumNodeIssue` ([`issue-planner.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts) — the `not-equal` tail that today returns the named diagnostic) classifies the two ordered member lists the issue already carries: when the actual (DB) members are a **strict prefix** of the expected (contract) members, return one `AddNativeEnumValueCall` per appended value, in declaration order. Anything else — same length with any differing value (rename/reorder), shorter expected (removal), equal-length-prefix violations — returns the refusal conflict. The classification is pure list comparison on data the issue carries; no new diff machinery, no per-member child nodes (the node stays a leaf with positional `isEqualTo`, exactly as Slice A shipped it).

**2. Refusal wording states the policy in plain words, with a doc link.** The Slice-A diagnostic said "not auto-migrated yet" — jargon, and no longer true ("yet"). The replacement (operator wording ruling): `Native enum type "<schema>"."<name>" changed beyond appending new values (contract declares […], database has […]). Prisma Next does not modify a native enum's existing values (rename, removal, reorder) — see https://pris.ly/d/postgres-native-enums. Author the change manually with \`migration new\`.` Same conflict kind (`unsupportedOperation`), same location coordinate. The `pris.ly` short-link will point at the docs-site page; registering the slug and submitting the page to the docs site happen **independently of this PR** (operator ruling) — this slice only lands the page's markdown in-repo.

**2a. The user-facing "why" page lands in-repo.** The explainer at [`../../specs/why-native-postgres-enums.md`](../../specs/why-native-postgres-enums.md) (written for users, already flagged "migrate to `docs/` at close-out") moves to `docs/reference/postgres-native-enums.md` now, since the diagnostic links to its published form; the `projects/` copy becomes a pointer to the new home. Docs-site submission is the independent step above, not in this PR.

**3. One new op, through the standard machinery.** `AddNativeEnumValueCall` (factory name `addNativeEnumValue`) beside `CreateNativeEnumTypeCall`/`DropNativeEnumTypeCall` in `op-factory-call.ts`: renders `ALTER TYPE <qualified> ADD VALUE '<value>'` (qualified via `quoteQualifiedName`, value via `escapeLiteral` + `validateEnumValueLength`), lowered through the control adapter like every other call. Precheck: type exists and the value is absent; postcheck: the value is present. Each appended value is **its own op / its own statement** — never batched into one `ALTER`.

**4. The non-transactional caveat is documented and surfaced, not engineered around.** Postgres ≥ 12 permits `ADD VALUE` inside a transaction, but the added value is **unusable until that transaction commits**; the runner applies a space's op sequence under a single transaction (`concatenate-space-apply-inputs.ts`). Settled consequence (project spec #4): a migration that appends a value **and uses it** in the same migration (a `dataTransform` writing it, a default referencing it) fails at apply with Postgres's own "unsafe use of new value" error — that is the documented boundary, and splitting transactions or reordering around usage is out of scope. The op's rendered description (the `describe`/summary surface `migration plan` prints) carries the caveat sentence so the operator sees it at plan time. No new runner machinery, no per-op transaction flag.

**5. Control-policy grading rides Slice A unchanged.** The suffix-append issue flows through the same node-issue partition: `managed` plans the `ADD VALUE`s; `external`/`observed` suppress (an externally-appended value is not our drift to fix — R5). Strict verify still fails a member mismatch under `managed` and `external` exactly as Slice A pinned; only the **planner's** lowering changes.

**6. The hand-authored surface gains the same verb.** `postgres-migration.ts` gets `addNativeEnumValue({ schema, typeName, value })` via `controlAdapterFor('addNativeEnumValue')`, mirroring `createNativeEnumType`/`dropNativeEnumType` — so a refused change's manual path (`migration new`) can express the append it does want alongside hand-written rewrite steps.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer sitting: a planner-lowering change confined to one function's tail, one op class following two existing siblings, one migration-surface method, and their tests. No framework/family surface changes, no new diff machinery, no runner changes. Rollback is one revert.

## Scope

**In:** the suffix-append classification + `AddNativeEnumValueCall` lowering; the plain-language refusal diagnostic with the `pris.ly` link; the `docs/reference/postgres-native-enums.md` page (content from the project explainer, `projects/` copy becomes a pointer); the op class with prechecks/postchecks + caveat-bearing description; the hand-authored `addNativeEnumValue`; unit + planner tests; a live PGlite integration proof (single + multi append, all three refusal classes, external append suppressed); a **real-PostgreSQL** integration proof that the appended value round-trips CRUD (throwaway-database isolated, availability-gated, wired to the Postgres service CI already provisions).

**Deliberately out:**

- Enums-only-namespace visibility (a namespace declaring native enums but no tables) — the contract builder derives a namespace's existence from its **models**, so a model-less namespace never reaches verify/plan regardless of anything this slice does. The fix is a generic contract-builder change (every pack-contributed entity kind, not just native enums), pulled into its own follow-up slice; Slice A's `pruneTableLessNamespaces` prune stays as-is here.
- Transaction splitting / usage-aware ordering for same-migration value use — documented boundary (design point 4), permanently.
- `RENAME VALUE`, removal, reorder lowering — project non-goal, permanent.
- Positional inserts (`ADD VALUE … BEFORE/AFTER`) — a non-suffix insert is a reorder; refused.
- SQLite / Mongo — no native enum exists there.

## Pre-investigated edge cases

| Case | Behavior |
| --- | --- |
| Multiple values appended in one contract change | One op per value, declaration order (each its own statement) |
| DB has **more** members than the contract (live-appended value not yet adopted) | Not a suffix-append of the contract over the DB → refusal (adopt via `contract infer` or hand-author) |
| Duplicate member in the contract | Rejected at authoring/emit (existing entity validation), never reaches the planner |
| Appended value > 63 bytes | `validateEnumValueLength` throws at op construction (Slice-A rule, UTF-8 bytes) |

## Slice-specific done conditions

R8 and R9 proven against a live database: the append path applies and round-trips verify, and each refusal class (rename, removal, reorder) yields the diagnostic and zero ops (PGlite). Additionally, against a **real PostgreSQL server** (throwaway database, skipped when none is reachable), the appended value is usable for CRUD — INSERT / SELECT / UPDATE / DELETE in statements after the migration commits — which PGlite's single-connection model cannot fully stand in for. Plan output shows the caveat on the `ADD VALUE` op description. (CI-green, reviewer-accept, project-DoD floor inherited.)

## Open questions

None — the design is fully settled by project spec §4/§Phase-2 and migration-design §4–§5; the operator ruled the slice off the Supabase critical path, and the enums-only-namespace gap out of this slice (pulled to the generic contract-builder follow-up).

## References

- Project spec: [`../../spec.md`](../../spec.md) (§ operations table, § Phase 2, R8/R9)
- Migration design: [`../../specs/migration-design.md`](../../specs/migration-design.md) §4 (diff→ops table), §5 (the ops + caveat)
- Slice A (as-built substrate): [`../managed-native-enum-create-delete/spec.md`](../managed-native-enum-create-delete/spec.md) + PR #949; known-limitation note (the prune) at its § Known limitation
- Diagnostic being replaced: `mapNativeEnumNodeIssue`'s `not-equal` tail, `packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts`
- Runner transaction model: `packages/1-framework/3-tooling/migration/src/concatenate-space-apply-inputs.ts`
- Enums-only-namespace visibility (deferred): the generic contract-builder namespace-derivation follow-up slice

## Dispatch plan

See [`plan.md`](plan.md).
