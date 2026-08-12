# enums-as-domain-concept — Plan

**Spec:** `projects/enums-as-domain-concept/spec.md`
**Linear Project:** [Enums as a domain concept](https://linear.app/prisma-company/project/enums-as-a-domain-concept-696d6b36cb89) (team Terminal)

## At a glance

Two tracks. The **SQL track** is six slices: a contract **substrate** slice (TML-2850)
lands the two-plane enum shape; the Postgres check-constraint **enforcement** (TML-2851)
and the application **read surface** (TML-2852, typing + `db.enums` + ordering + emit-time
value-union narrowing) build on it; a **transitional PSL block** (TML-2882, placeholder
spelling `enum2`) makes the new mechanism authorable through PSL additively and exercises
it end-to-end in the demo's real emitted-contract app; the enum **member defaults**
(TML-2855) close the last parity gap; and the **cutover** (TML-2853) points `enum` at the
already-live lowering, retires the transitional keyword, migrates remaining native enums,
and deletes the native machinery.

The **Mongo track** is a single complete vertical slice (TML-2884): author → enforce via a
`$jsonSchema` validator → typed read + `db.enums`, proven end-to-end. It builds only on the
framework-level domain enum, so it is **fully independent** of the SQL track and the
cutover, and runs in parallel. Mongo has no native enum and no prior PSL `enum`, so it skips
the cutover entirely — its `enum` is the domain concept from day one.

The original constraint — `enum` is one keyword, so activation had to wait for one atomic
flip at the very end — is dissolved by the transitional keyword: **activation happens
additively at TML-2882**, where the new mechanism goes live through the product path
(PSL → emit → app) with native untouched. The dark window (built but unreachable through
PSL) ends there, not at the cutover. The cutover stays a single atomic PR, but its job
shrinks to **consolidation**: rename + migrate + delete, with the risky new lowering
already proven in production use.

## Current status & next (sequencing decision)

- **Done:** TML-2850 (substrate), TML-2851 (enforcement), TML-2852 (read surface),
  TML-2882 (transitional PSL `enum2` block), TML-2855 (member defaults), TML-2885
  (emit-typed `db.enums`) — all merged.
- **This PR:** **TML-2853 (cutover)** — `enum` keyword repointed to the domain concept,
  `enum2` retired, the native enum machinery deleted (codec, planner recipe, introspection
  adoption), the demo's converting migration + replay proof landed, and the 0.13→0.14
  upgrade entries (user + extension-author) recorded.
- **Remaining:** **TML-2884 (Mongo enums, one vertical slice)** — author → `$jsonSchema`
  enforce → typed read + `db.enums`, end-to-end; independent of the SQL track — and
  **TML-2886 (typing mechanism)**.
- **Why this changed from the original plan:** the cutover was first parked as a distant
  finale behind an "additive/dark, every merge green" framing; the dark window caused
  recurring confusion and hid a real bug (the read surface merged green while broken
  through emit). We first pulled the cutover forward; the transitional keyword goes
  further and removes the need to wait at all — the feature activates additively, and
  the cutover becomes pure consolidation.

## Composition

### Stack (deliver in order)

1. **Slice `enum-contract-substrate`** — Linear: [TML-2850](https://linear.app/prisma-company/issue/TML-2850)
   - **Outcome:** The new enum representation exists and round-trips, added **additively
     (dark)**. The `enumType` / `member` API produces a `domain…enum` entity (explicit
     codec + ordered name→value members) and a `storage…valueSet` entity (ordered
     permitted values); the using field and column each keep their always-present
     `codecId` and additionally carry a `valueSet` restriction reference in the
     space-aware coordinate shape; the contract round-trips through the serializer and
     passes validation. PSL `enum` and the existing default authoring keep emitting the
     native enum unchanged — no fixture changes, no behavior change. The new shape is not
     yet migration-capable (slice 2); it is exercised by the new API + direct-IR
     round-trip tests, not end-to-end migration.
   - **Builds on:** None. (Soft external: the `valueSet` reference shape tracks the
     TML-2500 / PR #745 carrier — see § Dependencies. Local refs carry no `spaceId`, so
     this is not blocking.)
   - **Hands to:** The two-plane contract shape — `domain…enum`, `storage…valueSet`, and
     the `valueSet` property + reference coordinate — that slices 2 and 3 consume.
   - **Focus:** the `enumType` / `member` authoring API; the two new IR entity kinds and
     the `valueSet` property on domain field + storage column; the new API's TS-DSL
     lowering into both planes; serializer, validator, round-trip. The new path uses the
     ordinary scalar codec — no bespoke enum codec. Deliberately out of scope: server-side
     enforcement (slice 2), client typing / defaults (slice 3), and the cutover that makes
     the new shape the meaning of `enum` and deletes native (slice 4). The native path
     stays the default and is untouched; **PSL `enum` is not repointed in this slice** (it
     keeps lowering to native — repoint is the slice-4 cutover).

2. **Slice `transitional-psl-enum-keyword`** — Linear: [TML-2882](https://linear.app/prisma-company/issue/TML-2882)
   - **Outcome (activation, additive):** a new top-level PSL block — placeholder spelling
     `enum2`, final transitional name settled at spec time — lowers to the new shape
     (domain `enum` + storage `valueSet` + field/column `valueSet` ref + check), reusing
     the TS-path lowering. Native `enum` is untouched. The demo authors `enum2 Priority`
     in its PSL schema; the emitted `contract.d.ts` carries the value union; `main.ts`
     consumes it (typed reads, `db.enums`, declaration-order `ORDER BY`) through the real
     emitted-contract workflow, with the migration adding the check. **This is where the
     new mechanism goes live through the product path** — no cutover required.
   - **Builds on:** Slice 1's lowering (TML-2850); slice 3's emit-time narrowing
     (TML-2852), so the emitted contract types the enum field as its union.
   - **Hands to:** TML-2855 (PSL `@default(member)` attaches to a real PSL enum field)
     and TML-2853 (the cutover becomes consolidation — see below).
   - **Focus:** psl-parser — the `enum2` block keyword, member `Name = value` syntax (RHS
     is the codec's JSON-encoded value), and the `@@type("codec-id")` block attribute (the
     member-value grammar is the one genuinely new piece; the cutover needs it anyway).
     contract-psl interpreter — a parallel declaration-processing path that looks up an
     `entityTypes.enum2` contribution and reuses the existing domain + value-set lowering;
     field resolution is unchanged (by-name descriptor map). Postgres pack — register the
     `enum2` entity-type factory. Demo — PSL `enum2 Priority`, re-emitted artifacts,
     migration, and a `main.ts` command consuming the enum through the emitted contract.
     ~500 lines + tests. **Out:** member defaults (TML-2855); the rename + native deletion
     (TML-2853); numeric-codec SQL rendering (stays guarded).

3. **Slice `delete-native-enum-machinery`** — Linear: [TML-2853](https://linear.app/prisma-company/issue/TML-2853)
   - **Outcome (consolidation: rename + migrate + delete):** PSL `enum` points at the same
     lowering the transitional keyword already exercises live; the transitional keyword is
     retired; remaining native enums (e.g. the demo's `user_type`) migrate to the
     `valueSet` + check form; canonical fixtures regenerate once; the native Postgres enum
     machinery (spec § What this replaces) is deleted. Build, type-checks, and
     `fixtures:check` pass; no `postgres-enum` discriminator or `PostgresEnumType`
     remains; the no-bare-cast ratchet is clean.
   - **Builds on:** TML-2851 (migrations/verification understand the new shape),
     TML-2852 (typed reads through emit), TML-2882 (the PSL lowering exists and is proven
     live — the cutover no longer builds it), TML-2855 (member-default parity),
     TML-2885 (R6 emit parity — `db.enums` literal-typed through the emitted contract).
   - **Hands to:** A single enum path under the single `enum` keyword — the project's end
     state.
   - **Focus:** repoint `enum` to the transitional block's lowering and retire the
     transitional keyword; migrate remaining native-enum usages; regenerate canonical
     fixtures; delete the enumerated native machinery; confirm `fixtures:check` and the
     cast ratchet. Still the project's only non-additive merge — but now a rename +
     migrate + delete with no new mechanism risk.

### Parallel group A — Postgres realization (independent of group B; builds on slice 1)

- **Slice `check-constraint-realization`** — Linear: [TML-2851](https://linear.app/prisma-company/issue/TML-2851)
  - **Outcome:** A `storage…valueSet` is enforced server-side by a check constraint, and
    member defaults render to DDL. `CheckConstraint` IR exists in a table-level `checks`
    array (the `uniques` / `indexes` / `foreignKeys` precedent); migrations add/remove
    permitted values by dropping and recreating the check (no type rebuild); the
    `enumMember` `ColumnDefault` variant renders `DEFAULT '<value>'`; schema verification
    compares the contract's expected check against the live database and reports drift.
  - **Builds on:** Slice 1's `storage…valueSet` + `domain…enum`.
  - **Hands to:** An enforced, migratable, default-capable Postgres realization of the
    value-set, replacing the deleted native ops/verification (consumed by slice 4).
  - **Focus:** `CheckConstraint` IR + `StorageTable.checks`; Postgres check DDL
    (create / add / remove); the `enumMember` default variant, its PSL/TS lowering, and
    its DDL rendering; check-based verification replacing `verifyEnumType`. Out of scope:
    client-side typing (slice 3). Touches the Postgres migration/planner surface and the
    `CheckConstraint` / `ColumnDefault` contract IR.

### Parallel group B — application read surface (independent of group A; builds on slice 1)

- **Slice `application-read-surface`** — Linear: [TML-2852](https://linear.app/prisma-company/issue/TML-2852)
  - **Outcome:** Reads and writes of an enum-typed field/column are statically the value
    union (not `string`) in both the ORM and the query-builder lanes; `db.enums.<Name>`
    exposes the ordered, literal-typed value tuple and member accessors at runtime;
    `ORDER BY` on an enum column sorts by declaration order.
  - **Builds on:** Slice 1's `domain…enum` + the field/column `valueSet` property.
  - **Hands to:** Enums usable idiomatically in application code — typed I/O, runtime
    introspection, declaration-order sort.
  - **Focus:** codec-`Output`-narrowed-by-`valueSet` typing in the ORM and query-builder
    lanes (R4 / R5); the `db.enums` runtime surface (R6); declaration-order `ORDER BY`
    rendering (R8). Touches the SQL lanes (`packages/2-sql/4-lanes/**`) and the runtime
    client — disjoint from group A's migration/planner surface. Out of scope: server-side
    enforcement and defaults (now TML-2855, parallel group C).

### Emit-typed `db.enums` — follows the transitional PSL block; cutover prerequisite

- **Slice `emit-typed-domain-enums`** — Linear: [TML-2885](https://linear.app/prisma-company/issue/TML-2885)
  - **Outcome:** R6 holds through the emitted contract: the emitter types the domain
    `enum` block in `contract.d.ts` (literal member tuples), and the `db.enums`
    accessor types resolve literal `values` / `members` for emitted-contract
    consumers — today they widen to `JsonValue` (runtime correct). Proven by an
    emit-then-consume type test; the demo's `priorityValue()` cast workaround is
    deleted as acceptance evidence.
  - **Builds on:** TML-2852 (the emitter's field-narrowing pattern, applied to the
    enum entity) + TML-2882 (the demo's PSL-authored enum as the proving ground).
    Independent of TML-2855.
  - **Hands to:** TML-2853 — the cutover's R1–R6 parity check is honest through emit.
  - **Why this exists:** surfaced by the PR #805 review (2026-06-10); same
    verify-through-emit escape class as TML-2852 D4. Spec R6 amended to require emit
    parity.

### Enum member defaults — follows the transitional PSL block (was parallel group C)

> Originally specced as an independent parallel slice, then promoted to next; now
> sequenced **after TML-2882** so its PSL `@default(member)` surface attaches to a real
> PSL enum field instead of being TS-only. Still the **last parity prerequisite** before
> the cutover. Independent of enforcement (TML-2851); builds on slice 1 + TML-2882.


- **Slice `enum-member-defaults`** — Linear: [TML-2855](https://linear.app/prisma-company/issue/TML-2855)
  - **Respecced 2026-06-10 (directional-invariant correction, spec §9):** the
    TML-2851-era `enumMember` `ColumnDefault` variant is a storage → domain reference,
    which violates the invariant that storage is plannable in isolation. **This
    slice's first task is to remove/redesign that carrier** (zero persisted instances
    exist, so it's churn-free) before persisting any default.
  - **Outcome:** `@default(Role.member)` works end-to-end — the storage column carries
    the **resolved literal** default (plannable from storage alone, `DEFAULT 'admin'`);
    member intent, where recorded, lives on the domain field (the legal direction);
    the TS `.default(Role.members.x)` + PSL `@default(member)` surfaces lower to that
    shape. Member-only-ness enforced at authoring/lowering.
  - **Builds on:** Slice 1's `domain…enum` + members; TML-2882's PSL enum field.
    Independent of enforcement (TML-2851) — a default renders a literal; it doesn't
    need the check.
  - **Hands to:** Member-default capability, consumed by the cutover (TML-2853).
  - **Focus:** remove the `enumMember` `ColumnDefault` variant + validator (replace
    with the resolved literal in storage + optional domain-side intent); TS-DSL
    `.default(member)`; PSL `@default(member)` lowering; `buildColumnDefaultSql`
    rendering of the literal. Out: the check (TML-2851), reads (TML-2852), the
    cutover (TML-2853).

### Parallel track — Mongo enums, one complete vertical slice (R10; independent of the SQL track)

- **Slice `mongo-enums-end-to-end`** — Linear: [TML-2884](https://linear.app/prisma-company/issue/TML-2884)
  - **Why one slice, not split:** authoring without reading proves nothing — a vertical that
    can't be exercised end-to-end can't be shown to work. This slice goes author → enforce →
    read in one PR, demonstrated against `mongodb-memory-server`.
  - **Outcome:** Mongo enums work end-to-end. A Mongo-bound `enumType` / `member` API and PSL
    `enum` lowering populate `domain.namespaces[ns].enum` and put a `valueSet` ref on the
    field; the collection's `$jsonSchema` validator gains an `enum` keyword for that field at
    `validationLevel: strict` (the database rejects out-of-set writes); reads narrow to the
    value union in the Mongo client; and `db.enums.<ns>.<Name>` is exposed on the Mongo
    facade. An integration test proves the loop: author a model with an enum field → an
    out-of-set write is rejected by the validator → an in-set read is typed as the value
    union → `db.enums` returns the ordered tuple.
  - **Builds on:** Only the framework-level domain enum (`ContractEnum`) and the existing
    `EnumAccessor` / `createEnumAccessor` runtime (reused unchanged). **Independent of every
    SQL slice and of the cutover** — runs in parallel, any time.
  - **Hands to:** Enums as a domain concept across **both** families — the project's full
    end state (with the SQL cutover) is one enum concept on SQL and Mongo.
  - **Focus:** Mongo `enumType`/`member` bound to Mongo codecs (mirrors the Postgres binding)
    + domain accumulation in `mongo-contract-ts`'s builder + a Mongo PSL `enum` entity-type
    contribution; the `$jsonSchema` field-`enum` emission in the Mongo JSON-Schema deriver;
    `InferFieldType` value-union narrowing by `valueSet`; `db.enums` on the `MongoClient`
    facade (reuse `buildNamespacedEnums`); the `mongodb-memory-server` integration test.
    **Out:** declaration-order sort (no Mongo schema-level enum-ordinal); member defaults
    (a Mongo `@default(member)` follow-up if wanted, not this slice); the SQL cutover.

## Dependencies (external)

- [ ] **TML-2500 / PR #745 — cross-contract-space reference carrier.** The `valueSet`
  and `enumMember` default reference shapes follow this carrier's coordinate convention
  (`namespaceId` with the `__unbound__` sentinel; optional `spaceId` whose presence is
  the cross-space discriminator). **Status:** M1 (the storage-plane carrier + aggregate-
  load checks) merged to `main`; authoring surface and planner/verifier wiring are
  M2/M3. **Not blocking:** slice 1's local enum references carry no `spaceId` and use the
  landed carrier shape; if the convention shifts before this project lands, the `valueSet`
  refs shift with it (spec § Deferred to plan).

## Sequencing rationale

- **Slice 1 first** because it lands the two-plane contract shape that every other slice
  reads. Nothing downstream can be specced against an unsettled substrate.
- **Slices 2 and 3 parallelise** because both build only on slice 1 and touch disjoint
  surfaces — slice 2 the Postgres migration/planner plus the `CheckConstraint` /
  `ColumnDefault` contract IR; slice 3 the SQL lanes plus the runtime client. The
  migration DDL path and the query/typing path do not collide, so the
  "different-surface slices parallelise; same-adapter slices serialise" heuristic applies
  in favour of parallel.
- **The transitional PSL block (TML-2882) activates the feature additively and ends the
  dark window early.** The original constraint — `enum` is one keyword, so the new shape
  could not be PSL-reachable until one atomic flip at the very end — is dissolved by a
  parallel transitional keyword. The new mechanism goes live through the product path
  (PSL → emit → app) while native `enum` is untouched, so every merge stays green *and*
  the feature is exercised end-to-end long before the cutover. **Correction to the
  original framing (kept for the record):** the long additive/*dark* runway was treated
  as a benefit ("every prior slice leaves `main` green"); it is a cost — it deferred all
  integration risk to the end and let slice 3 merge green while broken through emit. The
  first correction pulled the cutover forward; the transitional keyword removes the wait
  entirely.
- **The cutover (TML-2853) is consolidation, not activation.** Still one atomic PR (the
  `enum` keyword repoint, the transitional-keyword retirement, and the native delete
  belong together), still parity-gated (enforcement TML-2851 ✅, emit typing TML-2852,
  the live PSL lowering TML-2882, member defaults TML-2855), and still the project's only
  non-additive merge — but its risky part (the new PSL lowering) is already proven in
  live use by the time it lands. It also regenerates the canonical fixtures exactly once.
