# Reproduction record — TML-3037 dispatch D1

Every claim below comes from a run executed against the instrument on this branch. Nothing here is
inferred from reading code.

**Instruments:**

- `test/integration/test/cli-journeys/infer-roundtrip-fidelity.e2e.test.ts` — 8 `it()`s (IF.01–IF.08),
  run with `pnpm --filter integration-tests test:journeys test/cli-journeys/infer-roundtrip-fidelity.e2e.test.ts`.
  Result: **8 failed (8)**.
- `test/integration/test/infer-roundtrip-runtime.integration.test.ts` — 2 `it()`s (RT.01–RT.02),
  run with `pnpm --filter integration-tests test test/infer-roundtrip-runtime.integration.test.ts`.
  Result: **2 failed (2)**.

Both files assert the **fixed** behaviour, so every one of the 10 failures is a live reproduction.
All 8+2 fail today; each should flip to green as its fix lands.

## The inferred PSL the whole record is read from

This is the verbatim `contract.prisma` `contract infer` produces from the fixture schema. Seven of
the nine findings are visible in it directly.

```prisma
// use prisma-next
// Contract inferred from the live database schema. Edit as needed, then run `prisma-next contract emit`.

types {
  BirthDate = DateTime @db.Date
  PreciseBalance = Decimal @db.Numeric(10, 2)
}

model Users {
  id             Int             @id(map: "users_pkey")
  email          String
  balance        Decimal?
  preciseBalance PreciseBalance? @map("precise_balance")
  birthDate      BirthDate?      @map("birth_date")
  tags           String[]        @default(dbgenerated("'{}'::text[]"))
  metadata       Json            @default(dbgenerated("'{}'::jsonb"))
  identities     Identities?
  sessionses     Sessions[]

  @@index([metadata], map: "users_metadata_gin_idx", type: "gin")
  @@map("users")
}

model Identities {
  id       Int    @id(map: "identities_pkey") @default(autoincrement())
  userId   Int    @unique(map: "identities_user_id_key") @map("user_id")
  provider String
  user     Users  @relation(fields: [userId], references: [id], map: "identities_user_id_fkey")

  @@index([provider], map: "identities_provider_hash_idx", type: "hash")
  @@map("identities")
}

model Sessions {
  id       Int   @id(map: "sessions_pkey")
  userId   Int   @map("user_id")
  ownerRef Int?  @map("owner_ref")
  user     Users @relation(fields: [userId], references: [id], map: "sessions_user_id_fkey", index: false)

  @@map("sessions")
}
```

## The record

| # | Defect (spec §) | Reproduces? | Surfaced by | Test |
|---|---|---|---|---|
| 1 | Back-relation names double-pluralize | Yes | `contract infer` output | IF.01 |
| 2 | Infer prints a 1:1 back-relation emit can't parse | Yes | `contract emit` | IF.02 |
| 3 | Identity columns lose their default | Yes | `contract infer` output | IF.06 |
| 4 | Non-btree indexes can never emit | Yes — **both** `gin` and `hash` | `contract emit` | IF.04 |
| 5 | Unbounded `numeric` crashes at connect | Yes — **but not by the mechanism the spec names** | `createExecutionContext` | RT.01 |
| 6 | No `pg/date` codec exists | Yes | `.include()` at runtime | RT.02 |
| 7 | Array columns can't keep their default | Yes | `contract emit` | IF.03 |
| 8 | jsonb defaults report drift forever | Yes | `db verify --schema-only` | IF.07 |
| — | Dangling FKs drop silently | Yes | `contract infer` output | IF.05 |
| — | (whole-slice outcome) | Round trip fails at emit | `contract emit` | IF.08 |

---

### 1. Back-relation names double-pluralize — REPRODUCES

**Command:** `contract infer` (exit 0). The defect is in its output, not its exit code.

**Verbatim** — the `Users` field pointing at the already-plural `sessions` table:

```
  sessionses     Sessions[]
```

`IF.01` asserts `/\bsessions\s+Sessions\[\]/` and fails.

**Caveat on the fixture, worth knowing for D2's acceptance:** only the **to-many** side pluralizes.
My `identities` table has a UNIQUE FK, so it lands on the 1:1 side and prints `identities Identities?`
— `pluralize()` is never called for it. The spec's §"The instrument" list and defect-1 acceptance table
name `identities` as a double-plural case, and `generate-contract.ts`'s `DOUBLE_PLURALIZED_FIELD_NAMES`
carries `identitieses`; both are right about real Supabase (where `auth.identities` is 1:N from
`auth.users`) but do not describe this fixture. `sessionses` is the reproduction here. This is not a
spec error — just don't expect `identitieses` from this instrument.

### 2. Infer prints a 1:1 back-relation emit can't parse — REPRODUCES

**Command:** `contract emit`, exit **1**. (IF.02 first repairs the two unrelated emit-blockers — the
list default and the non-btree index types — so this error stands alone.)

**Verbatim:**

```
■  ✖ Failed to resolve contract source (PN-RUN-3000)
│    Why: PSL to SQL contract interpretation failed
│    Fix: Fix contract source diagnostics and return ok(Contract).
│    Issues (showing 1 of 1):
│      - [PSL_UNSUPPORTED_FIELD_TYPE] Field "Users.identities" type "Identities" is not supported in SQL PSL provider v1 (./contract.prisma:17:3)
```

Exactly as the spec describes: the uniqueness detection is right (`identities Identities?` is
correctly the 1:1 back side), and the field falls through to scalar resolution because the interpreter
only collects back-relation candidates `if (field.list)`.

### 3. Identity columns lose their default — REPRODUCES (both variants); `serial` is unaffected

**Command:** `contract infer` (exit 0). Visible in its output.

**Verbatim** — `users.id` is `GENERATED ALWAYS AS IDENTITY`, `sessions.id` is `GENERATED BY DEFAULT AS IDENTITY`:

```
model Users {
  id             Int             @id(map: "users_pkey")
...
model Sessions {
  id       Int   @id(map: "sessions_pkey")
```

Neither carries `@default(autoincrement())`. The `serial` control column does, confirming the spec's
account that `serial` works only because it sets a real `nextval(...)` default:

```
model Identities {
  id       Int    @id(map: "identities_pkey") @default(autoincrement())
```

IF.06 asserts all three and fails on the two identity columns while the `serial` assertion passes —
so it discriminates, rather than passing or failing wholesale.

### 4. Non-btree indexes can never emit — REPRODUCES for `gin` **and** `hash`

**Command:** `contract emit`, exit **1**.

**Verbatim** (`gin`, the first index validated):

```
■  ✖ Failed to resolve contract source (PN-RUN-3000)
│    Why: Namespace "public" table "users" index on columns [metadata] uses unregistered index type "gin"
│    Fix: Ensure contract.source.load resolves to ok(Contract) or returns structured diagnostics.
```

Validation stops at the first offender, so I confirmed `hash` separately by removing only the `gin`
argument and re-emitting:

```
│    Why: Namespace "public" table "identities" index on columns [provider] uses unregistered index type "hash"
```

Both reproduce. That temporary probe was removed; IF.04 covers the pair through the `gin` error.

### 5. Unbounded `numeric` crashes at connect — REPRODUCES, but **not via `@db.Numeric`**

**Command:** `contract infer` → `contract emit` (both exit **0**), then `createExecutionContext`.

**Verbatim:**

```
RuntimeError {
  "message": "Column 'amount_probe.amount' uses parameterized codec 'pg/numeric@1' but no typeParams are supplied. Provide typeParams on the column, or use a typeRef pointing at a storage.types entry that carries them.",
  "code": "RUNTIME.CODEC_PARAMETERIZATION_MISMATCH",
  "category": "RUNTIME",
  "severity": "error",
  "details": {
    "actual": "no typeParams",
    "codecId": "pg/numeric@1",
    "column": "amount",
    "expected": "parameterized",
    "table": "amount_probe",
  },
}
```

**Where the spec is imprecise — D4 should read this before starting.** The spec frames this as an
attribute problem ("`@db.Numeric` with no args"), but infer never prints `@db.Numeric` for an
unbounded `numeric` column. It prints a bare `Decimal`:

```
  balance        Decimal?
```

and only the *bounded* `numeric(10,2)` gets an attribute, via a named type:

```
types {
  PreciseBalance = Decimal @db.Numeric(10, 2)
}
```

So the crash arrives through the **base-scalar** path — `postgresScalarTypeDescriptors` maps
`'Decimal' → 'pg/numeric@1'` (`packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts`),
producing a `pg/numeric@1` ref with no `typeParams` at all. Every `Decimal` field on postgres reaches
this, `@db.Numeric` or not.

This does not change the chosen fix — making `precision` optional on `NumericParams` /
`numericParamsSchema` still resolves it, and the "not infer-specific, needs an authoring-surface test"
note still holds. It changes the **blast radius**: the affected surface is bare `Decimal`, which is
wider than the spec's framing suggests. D4's authoring-surface test should cover bare `Decimal`, not
just `@db.Numeric` with no args.

### 6. No `pg/date` codec exists — REPRODUCES

**Command:** `contract infer` → `contract emit` (both exit 0), then a real `ExecutionContext` +
`PostgresRuntimeImpl`; top-level `.select()` first, then `.include()`.

Top-level `select('id', 'notedOn')` succeeds and returns a `Date` — matching the spec's account that
`decode()` is a passthrough over an already-parsed value. `.include()` on the same column throws:

```
RuntimeError {
  "message": "Failed to decode column record.noted_on with codec 'pg/timestamptz@1': Invalid ISO date string for pg/timestamptz@1: 2024-01-15",
  "cause": Error {
    "message": "Invalid ISO date string for pg/timestamptz@1: 2024-01-15",
  },
  "code": "RUNTIME.DECODE_FAILED",
  "category": "RUNTIME",
  "severity": "error",
  "details": {
    "codec": "pg/timestamptz@1",
    "column": "noted_on",
    "table": "record",
  },
}
```

The error names `pg/timestamptz@1` on a `date` column, confirming the spec's mechanism exactly:
`@db.Date` carries `codecId: null` ("inherit from base"), `DateTime` on postgres is `pg/timestamptz@1`,
and `decodeJson`'s ISO-timestamp regex rejects a bare `YYYY-MM-DD`.

**One note for D4 on the assertion, not on the defect:** the top-level `select()` half asserts
`toBeInstanceOf(Date)`, not an exact instant. The driver builds a `date` column's `Date` at *local*
midnight, so the instant is environment-timezone-dependent (it came back `2024-01-14T23:00:00.000Z`
on this machine, in CEST). Once `pg/date@1` lands and owns the conversion, that assertion can and
should tighten to the exact value.

### 7. Array columns can't keep their default — REPRODUCES

**Command:** `contract emit`, exit **1**.

**Verbatim:**

```
■  ✖ Failed to resolve contract source (PN-RUN-3000)
│    Why: PSL to SQL contract interpretation failed
│    Fix: Fix contract source diagnostics and return ok(Contract).
│    Issues (showing 1 of 1):
│      - [PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED] Field "Users.tags" is a list and cannot use an execution default ("dbgenerated("'{}'::text[]")"). Lists have no per-element execution-default semantics; use a literal list @default or remove the default. (./contract.prisma:15:34)
```

### 8. jsonb defaults report drift forever — REPRODUCES

**Command:** `contract infer` → (repair the three unrelated emit-blockers) → `contract emit` (exit 0)
→ `db verify --schema-only`, exit **1**. The database is the one the contract was inferred *from*,
and nothing changed in between.

**Verbatim:**

```
│  Schema issues:
│    ✖ mismatch: database/public/users/column:metadata/default
│
│  ✖ Database schema does not satisfy contract (1 failure) (PN-SCHEMA-0001)
```

**A reduction artifact D7 should know about.** My first cut of IF.07 repaired the non-btree indexes by
stripping only the `type:` argument. That produced two *extra* verify mismatches that are not among the
eight:

```
│    ✖ mismatch: database/public/identities/index:provider
│    ✖ mismatch: database/public/users/index:metadata
```

Those are declared-btree-vs-live-gin/hash — an artifact of the repair, not a defect. IF.07 now drops
the two `@@index` attributes entirely, so they become undeclared "extras" that non-strict schema-only
verify tolerates, and the jsonb mismatch stands alone. Worth remembering if a later dispatch reduces
this PSL for its own purposes.

### Dangling FKs drop silently — REPRODUCES

**Command:** `contract infer` (exit 0).

`sessions.owner_ref` references `secure.owners`, outside the introspected `public` schema. The scalar
column survives, as the spec says it should:

```
model Sessions {
  id       Int   @id(map: "sessions_pkey")
  userId   Int   @map("user_id")
  ownerRef Int?  @map("owner_ref")
  user     Users @relation(fields: [userId], references: [id], map: "sessions_user_id_fkey", index: false)

  @@map("sessions")
}
```

There is **no comment** anywhere on or above `model Sessions` explaining the dropped relation. IF.05
asserts both halves — the surviving column (passes) and the comment (fails) — so it discriminates.

The precedent the spec points at is real and works: `infer-psl-contract.ts` emits
`// WARNING: This table has no primary key in the database` above a PK-less model, and the printer
renders `model.comment` immediately above the `model` line
(`packages/1-framework/2-authoring/psl-printer/src/serialize-print-document.ts`).

### Whole-slice outcome — the round trip fails at emit

**Command:** `contract infer` (exit 0) → `contract emit` on the **unmodified** inferred PSL, exit **1**.

**Verbatim:**

```
■  ✖ Failed to resolve contract source (PN-RUN-3000)
│    Why: PSL to SQL contract interpretation failed
│    Fix: Fix contract source diagnostics and return ok(Contract).
│    Issues (showing 2 of 2):
│      - [PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED] Field "Users.tags" is a list and cannot use an execution default ("dbgenerated("'{}'::text[]")"). Lists have no per-element execution-default semantics; use a literal list @default or remove the default. (./contract.prisma:15:34)
│      - [PSL_UNSUPPORTED_FIELD_TYPE] Field "Users.identities" type "Identities" is not supported in SQL PSL provider v1 (./contract.prisma:17:3)
```

`db verify --schema-only` is never reached. IF.08 is the slice's headline acceptance: it goes green
only when every fix has landed.

## Not a defect: an install-state trap

The runtime test first failed with:

```
Error: Cannot find package '@internal/sql-schema-ir/naming' imported from .../packages/2-sql/1-core/contract/dist/foreign-key-materialization.mjs
```

This is the `workspace-package-not-found-run-pnpm-install` rule's case, not a code bug: the
`@internal/sql-schema-ir` symlink was missing from `packages/2-sql/1-core/contract/node_modules/@internal/`.
`pnpm install` fixed it and left `pnpm-lock.yaml` unchanged. If a later dispatch sees this, install —
don't debug it.
