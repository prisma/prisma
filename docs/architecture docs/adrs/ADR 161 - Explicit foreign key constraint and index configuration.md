# ADR 161 — Explicit foreign key constraint and index configuration

> **Status: superseded — foreign keys and indexes are discrete contract entities.** The per-FK `constraint` and `index` booleans decided below are retained as the record of the original design; the corrected decision and its rationale are in [Foreign keys and indexes are discrete entities](#foreign-keys-and-indexes-are-discrete-entities) immediately below. Implementation is tracked as a follow-up.

## Foreign keys and indexes are discrete entities

A foreign key is a referential constraint; an index is an index. The contract carries each as its own entity, and if one is absent it is simply absent — never a boolean on the other.

The JSON below illustrates the shape this model proposes; the exact field layout is settled when the follow-up implements it (this ADR is superseded and the work deferred), so it is conceptual notation, not a literal of today's `contract.json`.

```jsonc
// A FK whose columns have a backing index — two discrete facts:
"foreignKeys": [
  { "name": "identities_user_id_fkey", "source": { "columns": ["user_id"] },
    "target": { "tableName": "users", "columns": ["id"] }, "onDelete": "cascade" }
],
"indexes": [
  { "name": "identities_user_id_idx", "columns": ["user_id"] }
]

// A FK with no backing index — the index entity is simply absent:
"foreignKeys": [
  { "name": "mfa_amr_claims_session_id_fkey", "source": { "columns": ["session_id"] },
    "target": { "tableName": "sessions", "columns": ["id"] }, "onDelete": "cascade" }
]
```

### Why the boolean cannot stand

Ask the emitted contract one question: *a foreign key has a backing index — what is that index's name?* The `index: true` boolean cannot answer. It can only ever mean "the index this FK would be given by deterministic naming ([ADR 009](ADR%20009%20-%20Deterministic%20naming.md))"; it is structurally unable to name an index called anything else — such as a real database's `identities_user_id_idx`. The contract asserts a named database object exists and cannot tell you its name. That is not a fact about what exists; it is a lossy encoding that discards the object's identity, recoverable only by re-running a naming algorithm that lives outside the contract.

The boolean also contradicts this ADR's own self-containment claim. The decision below states "every FK is self-contained and interpretable without consulting any other part of the contract," yet [§5](#5-deterministic-planner-behavior) makes the index conditional on *the rest of the table* — "emit `CREATE INDEX` … **if no covering index**." So a reader cannot tell from the FK node whether a distinct index exists; they must scan the table's other indexes and apply the covering rule. `index: true` on a FK already backed by an explicit index is the same fact stated twice, reconciled by a rule — not a self-contained value.

This is the contract's *facts, not instructions* principle ([Data Contract subsystem](../subsystems/1.%20Data%20Contract.md), design principle #4): `constraint` and `index` are directives to the planner ("emit this DDL") and verifier ("check for this"), not statements of what exists. The statements of what exist are: this referential constraint, and this named index.

### The corrected model

Emit **materializes** the authoring sugar into discrete entities. A storage foreign-key entity is the referential constraint only (source, target, `onDelete`/`onUpdate`). Every index — including one that happens to back a FK — is a discrete index entry carrying its own name. The `constraint`/`index` knobs survive only as *authoring input* (`foreignKeyDefaults`, per-FK overrides); they are lowered at emit and never appear in `contract.json`.

Every environment case the original decision raised is expressed by presence or absence of a discrete entity, which is *more* faithful, not less:

- **Managed services that omit FK constraints but keep the index** (e.g. PlanetScale): the domain relation is present (the ORM still knows the relationship), the storage foreign-key entity is absent (no physical constraint), and the index entity is present. The relation/constraint split already models exactly "a logical relationship with no enforced constraint" — cleaner than `constraint: false`.
- **Intentionally skipping a FK's index**: no index entity for those columns.
- **Postgres not auto-indexing FKs**: the presence or absence of a named index entity *is* the fact — nothing is inferred from a flag.

The original per-FK boolean design, its authoring sugar, and its planner/verifier behavior are recorded unchanged below as the superseded approach.

## Context

Prisma Next expresses every schema intent through the data contract. Foreign keys are already modeled in the contract as structural facts — they declare which columns reference which table. However, the control plane today always emits both the FK constraint DDL **and** a supporting index for every declared FK, with no user override.

Different environments demand different FK behavior:

- **Managed services** like PlanetScale omit FK constraints entirely; users still want indexes on FK columns.
- **Performance-sensitive workloads** may intentionally skip FK-supporting indexes when data patterns already cover the access path (e.g., a composite index that starts with the FK columns).
- **PostgreSQL** automatically creates indexes for primary keys and unique constraints, but **not** for foreign keys. Some environments add them, others do not.

Without explicit knobs, the planner either over-emits (wasted DDL) or under-emits (missing constraints/indexes), and the verifier can't distinguish intentional absence from drift.

## Problem

Users need to control whether FK constraints and FK-supporting indexes are emitted in migration DDL, and whether the verifier reports their absence as drift. The behavior must be explicit, deterministic, and visible in the contract without hidden runtime emulation or target-guessing magic.

## Constraints

- **ADR 003 (explicit over implicit):** behavior must be opt-in and visible in the contract.
- **ADR 010 (canonicalization):** per-FK fields are part of storage and affect `storageHash`.
- **ADR 009 (deterministic naming):** FK constraint and generated index names follow deterministic naming rules.
- **ADR 065 / ADR 117 (capability model):** gating uses capability keys, never target-name branching.
- **ADR 038 (idempotency):** FK/index operations must keep explicit pre/post checks and remain replay-safe.
- **Self-contained nodes:** Each object in the contract must be interpretable from its own node without global mode flags.

## Decision

### 1. Per-FK configuration fields

Each `ForeignKey` entry in `storage.tables.*.foreignKeys[]` carries explicit boolean fields:

```ts
type ForeignKey = {
  readonly columns: readonly string[];
  readonly references: ForeignKeyReferences;
  readonly name?: string;
  readonly constraint: boolean; // Emit ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY
  readonly index: boolean;      // Emit CREATE INDEX for FK columns
};
```

These fields are **required** in the canonical contract JSON — every FK is self-contained and interpretable without consulting any other part of the contract. There is no global mode flag.

### 2. Contract-level defaults (authoring sugar)

The TypeScript contract DSL provides a root `foreignKeyDefaults` option. During lowering, defaults are **materialized** into each FK node:

```ts
const User = model('User', {
  fields: {
    id: field.column(int4Column).id(),
  },
}).sql({ table: 'user' });

const Post = model('Post', {
  fields: {
    id: field.column(int4Column).id(),
    userId: field.column(int4Column),
  },
}).sql(({ cols, constraints }) => ({
  table: 'post',
  foreignKeys: [constraints.foreignKey(cols.userId, User.refs.id)],
}));

const contract = defineContract({
  family: sqlFamily,
  target: postgresPack,
  foreignKeyDefaults: { constraint: false, index: true }, // PlanetScale-style
  models: { User, Post },
});
```

Per-FK overrides take precedence over defaults:

```ts
constraints.foreignKey(cols.userId, User.refs.id, { constraint: true })
// ^^^ constraint: true overrides the default false
```

### 3. No global config in canonical contract

The emitted `contract.json` contains **no** top-level `foreignKeys` config. All FK behavior is expressed per-node inside `storage.tables.*.foreignKeys[]`.

### 4. Canonicalization and hashing

Per-FK fields live inside `storage.tables`, which is already included in `storageHash` computation. Changing FK fields between contract revisions produces a new hash and a new migration edge.

### 5. Deterministic planner behavior

The planner reads each FK's `constraint` and `index` fields individually:

- `fk.constraint === true` → emit `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`
- `fk.constraint === false` → skip FK constraint DDL for this FK
- `fk.index === true` → emit `CREATE INDEX` for this FK's columns (if no covering index)
- `fk.index === false` → skip FK-backing index for this FK

This enables **mixed configs** within a single contract (e.g., one FK with constraint, another without).

### 6. Schema verification

The verifier reads each FK's fields individually:

- `fk.constraint === true` → missing FK constraint is reported as `foreign_key_mismatch`
- `fk.constraint === false` → FK constraint presence/absence is not verified
- `fk.index === true` → missing FK-backing index is reported as `index_mismatch`
- `fk.index === false` → FK-backing index is not verified

### 7. Normalization

For backward compatibility with older contract.json files, normalization fills missing `constraint` and `index` fields with defaults (`true`).

### 8. Capability keys

| Key | Type | Reported by | Meaning |
|---|---|---|---|
| `sql.foreignKeys` | boolean | adapters that support FK constraints | Database supports `FOREIGN KEY` DDL |
| `sql.autoIndexesForeignKeys` | boolean | adapters where the DB auto-indexes FKs | Database automatically creates indexes for FKs |

Postgres reports `sql.foreignKeys: true` and `sql.autoIndexesForeignKeys: false`.

## Consequences

### Positive

- FK behavior is fully explicit and deterministic per-node.
- Each FK entry is self-contained — no global mode flags.
- Mixed FK configs within a single contract are supported.
- Migration planner output is predictable per-FK.
- Capability gating ensures fail-fast diagnostics for unsupported configurations.

### Negative

- Users must set `constraint: false` for FK-less environments. This is intentional: explicit over implicit.
- Changing FK config requires a new migration (hash changes). This is correct: schema intent changed.
- Every FK entry in the canonical JSON must include `constraint` and `index`, making the JSON slightly more verbose.

## Scope

**v1 (this ADR):**
- Per-FK `constraint` and `index` fields in the contract IR.
- TS contract builder support with `foreignKeyDefaults()` sugar.
- Per-FK planner emission/omission.
- Schema verification per-FK.
- Postgres-first implementation and tests.

**v2 (deferred):**
- Capability-gated behavior (`sql.foreignKeys`, `sql.autoIndexesForeignKeys`). Capability keys are documented in `capabilities.md` but planner enforcement is deferred until a non-Postgres target requires it.

**Out of scope:**
- Runtime emulated referential integrity.
- Cross-target rollout beyond Postgres.
