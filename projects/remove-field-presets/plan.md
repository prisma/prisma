# Plan: remove field presets

> Written 2026-10-19 against `main` at da82c8c864. Linear: TML-3607. Spec: [spec.md](spec.md). Design: ADR 275.

## Summary

Three PRs, in order. Each one is usable on its own and leaves `main` green. Slice 1 adds the new way to write generated values and makes `@default` mean the database only. Slice 2 stops storing aliases. Slice 3 removes presets.

| Slice | What the user gets | Requirements | Size |
|---|---|---|---|
| 1. Generator attributes | `@onCreate(fn())` and `@onUpdate(fn())` in SQL and Mongo PSL, and `.onCreate(gen.fn())`/`.onUpdate(...)` in both TypeScript builders, resolved by codec. `uuid()` works on SQLite `String` and Postgres `VarChar`. `ksuid()` exists. `@default(uuid())` is refused with the `@onCreate` form. `contract print` writes every generated column as attributes, including on-update generators and a generator beside a database default, which it refuses today. Presets still work. | R1–R15, R27–R30, R32, R33, R35 (first half), R36 (partly), R37 | Large |
| 2. Aliases are expanded | `types {}` aliases may carry `@default`, `@onCreate`, `@onUpdate`, and Mongo PSL accepts aliases. Contracts no longer store aliases. Postgres, SQLite and Mongo contribute `temporal.CreatedAt` and `temporal.UpdatedAt`. TypeScript gets a `type.*` helper for every type constructor. An upgrade script rewrites stored contracts and snapshots. | R16–R24, R31, R35 (second half), R38, R39 | Large |
| 3. Presets removed | Every preset, `field.generated`, the `option` argument kind and the `select` template are gone. The language server loses its preset branches. Upgrade instructions give the PSL and TypeScript rewrite for every preset. | R25, R26, R34, R36 (rest) | Medium |

## Slice 1: generator attributes

Spec: [slices/01-generator-attributes/spec.md](slices/01-generator-attributes/spec.md).

Scope:
- The generator function registry: shape and assembly in `@internal/framework-components`, definitions and family-codec bindings in `@internal/family-sql`, target bindings in the Postgres, SQLite and Mongo targets.
- `@onCreate` and `@onUpdate` specs and lowering in SQL PSL and Mongo PSL.
- The default function registry keeps `autoincrement` and `now` only, and its `lower` loses the client-generator result. Every `@default(<client function>())` in examples, fixtures, tests and docs moves to `@onCreate` in the same PR (about 88 Prisma 8 `.prisma` files and 21 TypeScript files; the contracts do not change).
- `.onCreate` and `.onUpdate` with `gen` in the SQL and Mongo TypeScript builders.
- The Prisma 7 and Prisma 6 Mongo readers resolve through the registry.
- `contract print` writes attributes and loses its preset print search, because nothing it writes is a preset any more.
- Language server plumbing so `@onCreate(` completes from the registry.
- Upgrade fragments: app (the `@default` rewrite, with a script) and extension (default functions cannot lower to client generators; generator functions replace `printArguments` and `applicableCodecIds`).

Why print moves to attributes in slice 1, not slice 3: once attributes exist, the attribute form is the only output that is deterministic and covers every column, including on-update generators that no preset writes. Keeping the preset print search for one more slice would mean writing output in a form slice 3 then refuses.

## Slice 2: aliases are expanded

Scope:
- PSL alias expansion: `packages/2-sql/2-authoring/contract-psl/src/psl-named-type-resolution.ts` resolves an alias's type constructor and its attributes and applies them to each field. `validateNamedTypeAttributes` accepts `@default`, `@onCreate`, `@onUpdate` and refuses `@id`, `@unique`, and a field that repeats an attribute its alias sets.
- Mongo PSL accepts `types {}` and expands it (`packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts` refuses named types today).
- The SQL TypeScript builder stops storing aliases: the `types` key and `field.namedType(...)` for codec instances are removed (`packages/2-sql/2-authoring/contract-ts/src/contract-lowering.ts`, `lower-column.ts`, `build-contract.ts`, `contract-dsl.ts`). A TypeScript alias is a constant. `type.*` gets a helper for every PSL type constructor of the stack, and `field.column` accepts its result.
- Contributed aliases: a type alias descriptor kind in `AuthoringContributions.type` (`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts`), expanded by PSL and the TypeScript builder; `temporal.CreatedAt`, `temporal.UpdatedAt` and the Postgres `String` and `JsDate` variants.
- `storage.types` keeps registered database types only (`packages/2-sql/1-core/contract/src/validators.ts`, `ir/sql-storage.ts`). `contract.d.ts` emission (`packages/2-sql/3-tooling/emitter/src/index.ts`) follows.
- Runtime: `ExecutionContext.types` and `initializeTypeHelpers` are removed (`packages/2-sql/4-lanes/relational-core/src/query-lane-context.ts`, `packages/2-sql/5-runtime/src/sql-context.ts`). `codecRefForColumn` no longer resolves user aliases (`packages/2-sql/4-lanes/relational-core/src/codec-ref-for-column.ts`).
- Migrations: `sameStorageColumn` compares resolved storage (`packages/2-sql/9-family/src/core/migrations/field-event-planner.ts`). `planTypeOperations` and `verifyType` stay for registered types.
- `contract print` writes no `types {}` block (`packages/3-targets/3-targets/postgres/src/core/psl-print/domain-types.ts`) and drops `refuseColumnDifferingFromNamedType`.
- Supabase: re-generate the space contract with `packages/3-extensions/supabase/scripts/generate-contract.ts` in the expanded form.
- The upgrade script: rewrites `contract.json` files and migration snapshots into the expanded form and refreshes their storage hashes, then the user runs `db sign`. It follows `upgrade-instructions/pending/remove-nocheck/`, with tests under `test/integration/test/upgrade-instructions/`. About 34 committed `contract.json` files carry a `typeRef` today, 10 of them migration snapshots in `examples/prisma-8-demo` and `examples/prisma-8-postgis-demo`.
- The `@updatedAt` hint adds `temporal.UpdatedAt`.
- ADR amendments: ADR 104, 208, 212 (AST-bound codec resolution), 241, 254 (the `storage.types` sentence).

## Slice 3: presets removed

Scope:
- Remove the `fieldPreset` descriptor kind and `instantiateAuthoringFieldPreset` (`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts`), `temporal-presets.ts`, `field-preset-print-form.ts` if slice 1 left any of it, `packages/2-sql/9-family/src/core/authoring-field-presets.ts`, `timestamp-now-generator.ts`, the preset maps in the Postgres, SQLite and Mongo `authoring.ts`, PSL preset resolution (`packages/1-framework/2-authoring/psl-parser/src/field-presets.ts`, `packages/2-mongo-family/2-authoring/contract-psl/src/field-presets.ts`, the preset branches of `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts`), and the TypeScript preset helpers (`composed-authoring-helpers.ts`, `buildFieldPreset` in `contract-dsl.ts`, `FieldBuilderFromPresetDescriptor` in the Mongo `contract-builder.ts`).
- Remove the `option` argument kind and the `select` template node.
- Remove `field.generated(...)` and the TypeScript spec helpers in `@internal/ids` that bundle storage with a generator (`uuidv4()`, `nanoid()` and the rest in `packages/1-framework/2-authoring/ids/src/index.ts`).
- Language server: `completion-scope.ts`, `hover.ts`, `completion-snippets.ts` lose the preset and `option` branches.
- Diagnostics: remove `PSL_PRESET_*` and their entries in `docs/reference/error-reference.md`.
- Move every preset use: about 11 `.prisma` files with PSL preset calls, about 145 scalar preset calls (`field.text()` and the like) in 35 TypeScript files, about 116 `field.id.*`/`field.temporal.*` calls in 31 files, and 46 `field.generated(...)` calls in 25 files. Query fragments (ADR 259) use scalar presets in their field maps and move to `field.column(...)`.
- Upgrade fragments: app and extension, with the before-and-after table for every preset. A script is not planned: a preset call's replacement depends on the target and the codec, and the table is short.
- ADR amendments: ADR 170, ADR 246, ADR 181, ADR 254 ("or field preset"), ADR 259 examples. ADR 275 status to Accepted if slice 1 did not set it.

## Order and dependencies

- Slice 2 depends on slice 1: an alias carries `@onCreate` and `@onUpdate`, and a contributed alias names a generator function, both of which slice 1 adds.
- Slice 3 depends on slices 1 and 2: every preset needs its replacement to exist before it is removed. The identifier presets need slice 1's attributes. The `temporal.createdAt()` and `temporal.updatedAt()` presets need slice 2's contributed aliases. The scalar presets need slice 2's `type.*` helpers.
- Slices are built one at a time. Slice 2 starts after slice 1 merges.

## Why this split

The split in the brief holds, with two changes the code shows:

1. **`contract print` drops its preset output in slice 1, not slice 3.** See slice 1 above. The preset print search (`fieldPresetCallFor` in `packages/2-sql/9-family/src/core/psl-build/generated-values.ts`, `assembleFieldPresetsByCodecAndGenerator` in `packages/1-framework/1-core/framework-components/src/shared/field-preset-print-form.ts`, and four refusals in `packages/3-targets/3-targets/postgres/src/core/psl-print/refusals.ts`) is used only by print, so it goes with it.
2. **`type.*` helpers for every type constructor move to slice 2.** A TypeScript alias is a constant built from `field.column(type.X(...))`, and contributed aliases arrive as `type.temporal.UpdatedAt()`, so both need the `type` helpers that slice 2 adds. Slice 3 then only removes.

A different split was considered: building the TypeScript builder changes as their own slice after slice 1. Not chosen. PSL `@onUpdate(now())` would then have no TypeScript form except a preset, and the parity tests between PSL and TypeScript (`test/integration/test/authoring/parity/`) would have nothing to compare.

## Risks

- **Slice 1 is large.** It touches the framework, both families, three targets, two readers, print and the language server, plus about 110 files of mechanical rewrites. Mitigation: the slice spec's dispatch plan builds the registry first, then each consumer behind its own tests, and does the mechanical rewrite last with a script that the upgrade fragment also ships.
- **Extension authors break in slice 1.** A default function that lowers to a client generator, such as the `slugid` test pack in `test/integration/test/authoring/parity/default-pack-slugid/packs.ts`, stops working. The extension fragment says how to move it to a generator function. The pending fragment `upgrade-instructions/pending/contract-print-generated-values/extension/` tells authors to add `printArguments` to default functions; slice 1 corrects it, because that guidance is not released yet and would be wrong when it is.
- **`nanoid` size from the column.** Deriving size from a `VarChar(255)` would turn a 21-character identifier into a 255-character one. Slice 1 derives size from fixed-length columns only (see its spec). This refines ADR 275, which does not distinguish the two.
- **Storage hash churn in slice 2.** Every user with a `types {}` block must run the script and `db sign`. A user who skips it sees a hash mismatch, not a migration. The upgrade fragment leads with this.
- **Name collision in the `temporal` namespace during slice 2.** `temporal.UpdatedAt` (alias) and `temporal.updatedAt()` (preset) coexist until slice 3. They differ only by case. The PSL binder resolves names case-sensitively, so this works, but the language server lists both. Slice 3 removes the preset.
- **Query fragments (ADR 259) rely on scalar presets.** `field.uuidString()` and `field.text()` appear in fragment field maps and docs. Slice 3 moves them to `field.column(...)` and checks `ScalarFieldDeclarationBuilder` is still implemented by every builder.
- **Release assembly.** Each slice adds upgrade fragments. If slices 1 and 3 ship in one release, the release guide must present the `@default` rewrite and the preset rewrite together. The fragments name each other.

## When the project closes

After slice 3 merges: TML-3607 Done with a closing comment, follow-ups filed (parameterized contributed aliases; length checks for fixed-output generators), long-lived notes moved to `docs/`, and `projects/remove-field-presets/` deleted.
