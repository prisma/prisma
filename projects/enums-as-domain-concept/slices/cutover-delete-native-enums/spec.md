# Slice: cutover-delete-native-enums

Parent project: `projects/enums-as-domain-concept/`. The project's end state and its
**only non-additive merge**: `enum` becomes the domain concept, `enum2` retires, the
native Postgres enum machinery is deleted (R9). All parity prerequisites are merged
(TML-2851/2852/2882/2855/2885); the lowering this repoints to is live in production
use — this slice is rename + migrate + delete, no new mechanism.

## At a glance

```prisma
// Before — two keywords coexist:
enum  user_type { admin user }                          // native pg enum (CREATE TYPE … AS ENUM)
enum2 Priority  { @@type("pg/text@1") Low = "low" … }   // the domain concept

// After — one keyword; `enum` IS the domain concept:
enum Priority  { @@type("pg/text@1") Low    = "low" … }
enum user_type { @@type("pg/text@1") admin  = "admin" user = "user" }  // migrated
```

`enum2` is gone; `PostgresEnumType`, the `pg/enum@1` codec, the native migration
ops/planning/introspection, and the `'postgres-enum'` discriminator no longer exist
anywhere in the repo.

## Chosen design

**1. Repoint the keyword.** The sql-family block descriptor
(`packages/2-sql/9-family/src/core/authoring-entity-types.ts`) flips
`keyword: 'enum2'` → `'enum'` (and its discriminator/factory key to `'enum'`; the
diagnostic codes' `ENUM2` spelling follows to `ENUM`). The psl-parser's dedicated
native `enum` parse (`parser.ts` ~125–138 + `parseEnumBlock` ~416–466) is **deleted**
so the generic extension-block grammar (which has no built-in-keyword exclusion —
verified) claims the keyword via the descriptor. `processEnumDeclarations` (the
native path in `contract-psl/src/interpreter.ts` ~288–360) and the native `PslEnum` /
`PslEnumValue` AST + `namespace.enums` slot + the printer's `serializeEnum` are
deleted with it. The transitional `enum2` spelling survives nowhere (grep-zero,
except historical docs/specs).

**2. Delete the native machinery** (project spec § What this replaces — inventory
verified 2026-06-11, all items present):
`postgres-enum-type.ts` (+`PG_ENUM_CODEC_ID`/`pg/enum@1`),
`postgres-enum-storage-entry.ts` (+`'postgres-enum'` discriminator + guard),
`operations/enums.ts` (create/add/drop/rename type DDL), `enum-planning.ts` (+its
exports), `nativeEnumPlanCallStrategy` + `enumRebuildCallRecipe` +
`namespaceHasEnum`/`resolveColumnEnumNamespace`/`locateNamespaceType`
(planner-strategies.ts), `introspectPostgresEnumTypes` + `ENUM_INTROSPECT_QUERY` +
`parsePostgresArray` (adapter `enum-control-hooks.ts`), `verifyEnumType`,
`postgresAuthoringEntityTypes.enum` + its serializer hydration, the adapter-side
native `enumType`/`enumColumn` TS helpers and `enumEntity`. Their test files go with
them (`enum-collision.test.ts`, `enum-control-hooks.basic.test.ts`, the native halves
of printer/interpreter tests).

**3. Inference meets a live native enum → explicit diagnostic.** The project spec's
non-goals scope native-enum adoption OUT. With introspection deleted, `contract
infer` against a database containing `CREATE TYPE … AS ENUM` columns must fail with a
clear, actionable diagnostic (name the type, say native enums are not adoptable,
point at the value-set form) — never silently drop the column or print a stale native
block (per the explicit-opt-in-over-diagnostics and namespace-diagnostic-wording
rules, the wording names what was found and what to do). The
`print-psl.enums.test.ts` native round-trip tests convert to assert the diagnostic.

**4. Regenerate the demo migration history into the new representation, keeping it
multi-step (REVISED 2026-06-15, operator override).** The original pin here kept the
native ops replayable and ruled history-rewriting OUT. The operator overruled it
across two PR reviews. First (#817): a migration that demonstrates transitioning
**from a state the system can no longer produce** (a native `CREATE TYPE … AS ENUM`)
**to** the current representation is an incoherent teaching artifact, so the
native-enum arc and the `20260611T1856_convert_user_type_to_value_set` self-edge are
removed. Second (#829): collapsing the chain to a single from-empty baseline was also
wrong — the demo must keep a **multi-step incremental chain** so it actually exercises
the migration CLI (`db update` applying successive migrations, `migration status`/`list`
across a chain). So the demo's `examples/prisma-8-demo/migrations/app/` chain is
**re-authored from the original multi-step history in the new value-set representation**:
the original per-step `contract.prisma` snapshots are recovered, the initial migration
is edited to create `user.kind` as a `text` column with a `user_kind_check` CHECK
constraint from the start (no `CREATE TYPE`), the convert self-edge folder is deleted,
and every other incremental milestone (displayName add + backfill + NOT NULL, MTI
variant link columns, `post.priority` value-set + default) is preserved. All derived
artifacts (start/end-contract, ops.json, migration.json, from/to hashes) are
regenerated via `scripts/regen-example-migrations.mjs`; the chain applies cleanly
empty→current with no native enum anywhere. Tests that walk the chain
(`migration-integrity` — the no-op-bookend subject — and `migration-replay`) are
re-pointed at the regenerated chain.

**5. Migrate the stragglers** (inventory: the demo's `user_type` + `User.kind`, the
cloudflare-worker example's copy, the cli-e2e `contract-status-enum*` fixtures + the
`data-transform-enum-rebuild` e2e journey, printer/parser/interpreter test schemas):
- The demo: `enum user_type` becomes the new shape (values keep their exact strings:
  `admin = "admin"`, `user = "user"`); a new migration alters `User.kind` to `text`
  (`alterColumnType` with `USING kind::text`), adds the value-set check (TML-2851
  ops), and drops the `user_type` type (one last native-type drop — see component 4
  for what op carries it). Data is unchanged. Same for cloudflare-worker (no
  migration chain there — schema + artifacts only; verify).
- The `data-transform-enum-rebuild` e2e journey exercised the deleted rebuild recipe;
  it converts to the value-set equivalent (shrinking a value-set = check swap +
  optional data transform) or is deleted if TML-2851's coverage already proves that
  path — dispatch judgment, report which.
- Canonical fixtures regenerate **exactly once**.

**6. The upgrade entry is REAL this time.** Unlike the transitional PRs' no-action
comments, this is the project's breaking change: a `changes[]` entry in
`skills/upgrade/prisma-next-upgrade/upgrades/0.13-to-0.14/instructions.md` (and the
extension-author package if `packages/3-extensions/` is touched) describing the
`enum` semantic flip and the native→value-set migration recipe, with a detection
block (PSL `enum` blocks without `@@type`), per the record-upgrade-instructions
skill: validated by execution against the in-repo substrate.

## Coherence rationale

One sentence, one (large) review: *"`enum` now means the domain concept everywhere,
and the native machinery is gone."* The repoint, retirement, migration, and deletion
are mutually inseparable — `enum` is one keyword — which is exactly why the project
isolated everything else first. The diff is big but almost entirely deletion +
mechanical respelling; the only judgment sites are components 3 and 4.

## Scope

**In:** components 1–6; full sweep (build, `pnpm test:packages`, integration + e2e
suites touching migrations/cli journeys, full typecheck, `fixtures:check` single
regeneration, `lint:deps`, cast ratchet — R9 demands no new casts and expects a
**decrease** from the deleted machinery).

**Out:** Mongo (TML-2884 — no Mongo enum path exists today, verified); the §5 typing
mechanism (TML-2886); the ADR batch (operator's substrate workstream — but note the
`'postgres-enum'` discriminator deletion here removes the largest grandfathered tag
ahead of it); any native-realization return path (future, per the structural-strategy
seam).

## Contract-impact

Native-enum contracts stop being authorable — the breaking change this project
exists to make. Canonical fixtures and both examples' artifacts regenerate once
(storage loses the `type` entries for native enums; columns gain `valueSet` refs +
checks; hashes move). The wire shape for already-new-style enums is byte-identical.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Committed migrations referencing deleted ops | Component 4's pinned default (legacy-replay surface) | The demo's own history is the test. |
| `contract infer` against a DB with native enums | Diagnostic, never silent (component 3) | Convert the printer round-trip tests. |
| `@map` on enum members | Gone with the native syntax — `= value` carries it | A doc-visible removal; belongs in the upgrade entry. |
| Demo data during `kind` migration | `USING kind::text` casts in place; values unchanged | Assert via the demo integration suite post-migration. |
| `DROP TYPE` ordering | Drop only after the column no longer references it; same migration, ordered ops | The op carrier question is component 4. |

## Slice-specific done conditions

- [ ] Grep-zero: `enum2`, `postgres-enum`, `PostgresEnumType`, `pg/enum@1`,
  `pg_enum`, `enumEntity`, `nativeEnumPlanCallStrategy` (code + fixtures; historical
  project docs exempt).
- [ ] The demo's `user_type` migration applies on top of its existing chain and the
  demo suite passes against the migrated schema (including replay of the historic
  migrations that created the native type).
- [ ] `contract infer` against a native-enum database yields the component-3
  diagnostic (test proves it).
- [ ] The 0.13→0.14 upgrade entry exists with detection + recipe and was validated by
  execution per the skill.
- [ ] Cast ratchet decreases.

## Open Questions

None blocking — components 3 and 4 carry pinned defaults; deviations surface as
dispatch halts.

## References

- Parent: spec § What this replaces + R9; plan (stack position: final SQL slice);
  Linear [TML-2853](https://linear.app/prisma-company/issue/TML-2853).
- Grounding (2026-06-11): inventory + consumers per the cutover exploration —
  `postgres/src/core/{postgres-enum-type.ts, authoring.ts:43–53,
  migrations/{operations/enums.ts, enum-planning.ts, planner-strategies.ts:411–571}}`;
  adapter `enum-control-hooks.ts`; `contract/src/ir/postgres-enum-storage-entry.ts`;
  parser.ts:125–138/416–466; interpreter.ts:288–360; printer
  serialize-print-document.ts:54–56/86–100; native usages: demo + cloudflare-worker
  schemas, cli-e2e `contract-status-enum*`, `data-transform-enum-rebuild.e2e`,
  `enum-collision.test.ts`, `print-psl.enums.test.ts`, `enum-control-hooks.basic.test.ts`.
