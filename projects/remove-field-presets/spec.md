# Remove field presets: generated values are attributes, and a type alias is expanded

> Shaped 2026-10-19 against `main` at da82c8c864, after PR #30742 (date, time and text `now` generators, preset print forms) and PR #30750 (one stored form per default) merged. Linear: TML-3607. Design: [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](<../../docs/architecture docs/adrs/ADR 275 - Client generators are field attributes, and a type alias is expanded into each column.md>). This file holds what is true at the project level. Each slice spec holds its own rules and file list.

## Purpose

A field preset, such as `temporal.timestampString(3, onCreate: now)`, sets a column's codec, its type parameters and its client generators in one call. Its author pairs the codec and the generator by hand, which is how a text codec once got a generator that returns a `Date` (TML-3255). It is also a second way to write what attributes say, with its own argument vocabulary (ADR 246). And `@default(uuid())` looks like `@default(now())` but means the client, not the database, writes the value.

This project carries out ADR 275. Client generators become the attributes `@onCreate(fn())` and `@onUpdate(fn())`, resolved from the column's codec through a registry the stack assembles. `@default` means a database default only. A `types {}` alias may carry those attributes and is expanded into each column, so the contract never stores it. Field presets are removed from both families and both authoring surfaces. Targets contribute aliases such as `temporal.UpdatedAt` instead.

It is a breaking change to the schema language, so it lands before GA (row 5 of stream 1 in `planning/plan.md` on branch `planning/prisma-8-ga`).

## At a glance

PSL today:

```prisma
types {
  Slug = VarChar(64)
}

model Post {
  id        String @id @default(uuid())
  slug      Slug
  updatedAt temporal.timestampString(3, onCreate: now, onUpdate: now) @default(now())
  seenAt    temporal.time(3, onUpdate: now)
}
```

PSL after:

```prisma
types {
  Slug      = VarChar(64)
  UpdatedAt = TimestampString(3) @onCreate(now()) @onUpdate(now())
}

model Post {
  id        String    @id @onCreate(uuid())
  slug      Slug
  updatedAt UpdatedAt @default(now())
  seenAt    Time(3)   @onUpdate(now())
}
```

The emitted contract stores `slug` as `sql/varchar@1` with `{ "length": 64 }` and no `typeRef`, and `storage.types` holds no `Slug`. Every other column and every generator is the same as today, so the storage hash changes only because `Slug` is no longer stored.

TypeScript today:

```ts
const Post = model('Post', {
  fields: {
    id: field.id.uuidv4String(),
    updatedAt: field.temporal.timestampString(3, 'now', 'now').default(now()),
  },
});
```

TypeScript after:

```ts
const UpdatedAt = field.column(type.TimestampString(3)).onCreate(gen.now()).onUpdate(gen.now());

const Post = model('Post', {
  fields: {
    id: field.column(charColumn(36)).id().onCreate(gen.uuid()),
    updatedAt: UpdatedAt.default(now()),
  },
});
```

`gen`, `.onCreate`, `.onUpdate` and most `type.*` constructor helpers are new.

## Requirements

### The generator function registry

- R1. A generator function has a name (`now`, `uuid`, `cuid`, `ulid`, `nanoid`, `ksuid`), one argument signature, and bindings. A binding maps a set of codec ids to a resolver that turns the call's arguments and the column (codec id and type params) into a generator, or into a refusal with a message.
- R2. The family, the target and extensions contribute generator functions on their pack refs. The control stack and the TypeScript builder assemble them with the same function, so PSL and TypeScript resolve a call the same way.
- R3. Assembly fails with `CONTRACT.PACK_CONTRIBUTION_INVALID` when two components declare a signature for one name, when a binding names a function no component declares, when two bindings cover one function and codec, or (in the control stack) when a binding can produce a generator id no generator descriptor registers.
- R4. A generator's params come from the column's type params. The time `now` generators take the column's `precision`. `nanoid` takes its `size` from the call, or 21, never from the column; a size larger than a `Char(n)` or `VarChar(n)` length is refused.
- R5. Bindings are complete for every text-like codec of each target. `uuid()` on a SQLite `String` (`sqlite/text@1`) and on a Postgres `VarChar` (`sql/varchar@1`) work; today both are refused (`packages/1-framework/2-authoring/ids/src/index.ts`, `applicableCodecIds`).
- R6. The registry gives `contract print` the reverse direction: for a column and a stored generator, the function call that produces it.

### `@onCreate` and `@onUpdate` in SQL and Mongo PSL

- R7. `@onCreate(fn(...))` and `@onUpdate(fn(...))` are field attribute specs in the central registry (ADR 249) of both families. Each offers only the functions bound to the field's codec.
- R8. A call the registry cannot resolve for the field's codec is refused with a diagnostic that names the codec and the functions that do apply.
- R9. `@default(x)` and `@onCreate(fn())` on one column are allowed with no diagnostic. `@onUpdate` alone is allowed.
- R10. A list field cannot carry `@onCreate` or `@onUpdate`. Mongo keeps its existing rules for generated values on variant fields and on two models in one collection.

### `@default` limited to the database

- R11. The default function registry holds only functions that lower to a database default: `autoincrement()` and `now()` in SQL. `ControlMutationDefaultEntry.lower` can no longer return a client generator.
- R12. `@default(uuid())`, `@default(cuid(2))`, `@default(ulid())`, `@default(nanoid())` are refused in Prisma 8 PSL with a message that names the `@onCreate` form. Mongo keeps refusing `@default`, with a hint that names `@onCreate(now())`.

### The TypeScript builder

- R13. The SQL and Mongo field builders get `.onCreate(call)` and `.onUpdate(call)`, immutable like `.default()`. They take a call from `gen` (`gen.now()`, `gen.uuid(7)`, `gen.cuid(2)`, `gen.ulid()`, `gen.nanoid(16)`, `gen.ksuid()`), resolved by the column's codec at lowering.
- R14. `.onCreate` makes the field optional in the create input type, as a preset with an `onCreate` generator does today. `.onUpdate` alone does not.
- R15. `.default()` keeps taking a literal or the database functions `now()` and `autoincrement()`.

### Alias expansion

- R16. PSL `types {}` aliases and their TypeScript equivalent are expanded into each column at authoring. No column carries a `typeRef` to a user alias.
- R17. `storage.types` keeps only types a contract space registers as database types: pgvector's `vector` and PostGIS's `geometry`. Their storage hashes do not change.
- R18. The field event planner compares two columns by data type, codec and params, not by `typeRef`, so an upgraded contract fires no `altered` events.
- R19. `ExecutionContext.types` is removed. The codec control hooks `planTypeOperations` and `verifyType` run for registered types only.

### Attributes on aliases

- R20. An alias may carry `@default`, `@onCreate` and `@onUpdate`. `@id` or `@unique` on an alias is an error.
- R21. A field typed by an alias may add an attribute the alias does not set. Repeating one the alias sets is an error.
- R22. Mongo PSL accepts `types {}` aliases. They are expanded, so Mongo storage gains nothing.

### Contributed aliases

- R23. A pack's `type` namespace can contribute a type alias descriptor: a type constructor with fixed arguments and a generator function for each phase (amended 2026-10-21: no database default; one can be added when a pack needs it). It takes no parameters. PSL and TypeScript expand it like a user alias.
- R24. Postgres contributes `temporal.CreatedAt` and `temporal.UpdatedAt` on `Timestamptz`, plus `String` and `JsDate` variants. SQLite and Mongo contribute `temporal.CreatedAt` and `temporal.UpdatedAt` on their `DateTime`.

### Preset removal

- R25. The `fieldPreset` descriptor kind, `instantiateAuthoringFieldPreset`, the `option` argument kind, the `select` template node, the temporal preset builders, every `field.*` preset helper, `field.generated(...)`, the codec-instance form of `field.namedType(...)` and the TypeScript `types` key for codec instances are removed.
- R26. ADR 246's two omission rules stay: no empty `executionDefaults`, no empty `typeParams`.

### The Prisma 7 and Prisma 6 Mongo readers

- R27. The Prisma 7 reader resolves `@updatedAt` as `now` for both phases and Prisma 7's client functions in `@default` (`uuid()`, `cuid()`, `ulid()`, `nanoid()`) as `onCreate`, through the generator function registry. `@default(now())` stays a database default. `Prisma7TargetBinding.updatedAtGenerator` is removed.
- R28. The Prisma 6 Mongo reader resolves `@updatedAt` and `@default(now())` through the registry. `Prisma6TargetBinding.timestampGeneratorId` is removed.
- R29. The contracts both readers build do not change.

### `contract print`

- R30. Print writes each generated column as its type followed by `@onCreate(fn(...))` and `@onUpdate(fn(...))`, from the registry's reverse direction. It checks that the call it writes resolves back to the stored generator and refuses the column when it does not.
- R31. Print writes no `types {}` block for aliases and no contributed alias name. The expanded form is the one deterministic output.
- R32. The preset print forms and their refusals are removed.

### The language server

- R33. Completion and hover inside `@onCreate(` and `@onUpdate(` list the functions bound to the field's codec, with their signatures, through the attribute specs.
- R34. The field-preset completion and hover branches and the `option` argument rendering are removed. Contributed aliases complete in type position.

### Diagnostics

- R35. The `@updatedAt` hint in SQL and Mongo PSL names `@onCreate(now()) @onUpdate(now())`, and `temporal.UpdatedAt` once it exists.
- R36. The `PSL_PRESET_*` diagnostics and the refusal of preset-only generators in `@default` are removed. New diagnostics are listed in `docs/reference/error-reference.md`.

### Hashes and the upgrade script

- R37. Rewriting a preset or `@default(<client function>())` as attributes changes no hash when the column and generators are the same.
- R38. A contract with a `types {}` block or TypeScript `types` gets a new storage hash. The upgrade instructions ship a script that rewrites stored contracts and migration snapshots into the expanded form and refreshes their hashes, as `upgrade-instructions/pending/remove-nocheck/` does. Users then re-emit and run `db sign`.
- R39. Supabase's space contract (`packages/3-extensions/supabase/src/contract/`) is re-generated in the expanded form and gets a new hash. A foreign key from an app column to `auth.users.id` keeps verifying (`packages/3-extensions/supabase/test/cross-contract-fk.integration.test.ts`).

### Docs and ADR amendments

- R40. ADR 275 lists the ADRs it supersedes or amends. Each slice updates the ADRs its change touches, and the package READMEs, `skills/prisma-8/references/*` and `docs/reference/*` that show the old forms.

## Cross-cutting rules

1. **The codec decides.** A generator is chosen from the column's codec, never from its data type. Two codecs of one data type expect different in-memory values.
2. **One registry for every surface.** PSL, the TypeScript builder, the two readers, `contract print` and the language server read the same assembled registry. No surface keeps its own codec-to-generator table.
3. **Hard errors.** Every form this project removes is refused with a message that names its replacement. Nothing is accepted with a warning.
4. **Hashes stay where nothing changed.** A rewrite that produces the same columns and generators produces the same storage and execution hashes. Every slice proves this with a parity test between the old and new forms.
5. **Main stays green.** Each slice is one PR that is usable on its own. Every example, fixture, test schema and doc it makes invalid is moved in the same PR.
6. **No family vocabulary in the framework.** The registry's shape and assembly live in `packages/1-framework`. Function definitions and bindings live in family, target and extension packages.

## Non-goals

- Parameterized contributed aliases, such as `temporal.UpdatedAt(3)`.
- Length checks for generators with a fixed output length, such as `uuid()` on `Char(10)`. Only `nanoid`'s size is checked against the column (R4).
- `@updatedAt` as sugar in Prisma 8 PSL. It stays refused, with a hint.
- Database-side generators, such as Postgres `gen_random_uuid()` in `@default`. Those are written as a SQL tagged literal today and do not change.
- Changing mixins (ADR 269).
- Changing the public upgrade guide in prisma/web.

## Acceptance criteria

- Every PSL and TypeScript form in "At a glance" emits the contract this file describes, on Postgres, SQLite and Mongo where the form applies.
- For every preset in `main` at da82c8c864, the attribute or alias form that replaces it emits the same storage and execution hashes. The parity fixtures prove it.
- `@default(uuid())` and every preset call are refused with messages that name their replacements.
- `contract print` writes every generated column of every committed Postgres contract as attributes, and reading the printed file back gives the same hashes (`test/integration/test/psl-print/every-postgres-contract-roundtrip.integration.test.ts`).
- No committed `contract.json` outside pgvector and PostGIS has a `storage.types` entry or a `typeRef`.
- The upgrade script rewrites every stored contract and snapshot in `examples/` into the expanded form, and `db verify` against a database signed with the old hash passes after `db sign`.
- The Supabase cross-space foreign key test passes with the re-generated Supabase contract.
- No source file under `packages/` mentions `fieldPreset`, `kind: 'option'` or `kind: 'select'`.

## ADR pointer

ADR 275 records every decision. This project does not reopen them. Where the code needs a decision the ADR leaves open, the slice spec takes it and says why. Two of those refine the ADR and are recorded in the slice 1 spec: the size of `nanoid` never comes from the column's length, and `ControlMutationDefaultEntry.lower` loses its client-generator result, which breaks extension authors' default functions.

## Project Definition of Done

Inherits `drive/calibration/dod.md`. Project-specific:

- All three slices merged, each with its upgrade instructions fragment.
- ADR 275's status is Accepted, and every ADR it names is amended.
- TML-3607 is Done with a closing comment. Follow-ups are filed in Linear.
- `projects/remove-field-presets/` is deleted in the last PR, with long-lived content moved to `docs/`.
