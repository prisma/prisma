# typed-attribute-parsers — Plan

**Spec:** `projects/typed-attribute-parsers/spec.md`
**Linear issue:** [TML-2956](https://linear.app/prisma-company/issue/TML-2956) (under project _Language Tools Support Prisma Next PSL_)

## At a glance

Three slices in a substrate-then-consumers shape: slice 1 lands the combinator kit + `interpretAttribute` in `psl-parser`, proven by migrating `@relation` end-to-end in the SQL family; slices 2 and 3 then migrate the remaining SQL and Mongo attributes respectively, in parallel, each deleting its family's legacy parsing helpers.

## Composition

### Stack (deliver in order)

1. **Slice `attribute-spec-kit`** — Linear: _TBD_
   - **Outcome:** The combinator kit (`str`, `int`, `bool`, `enumOf`, `json`, `entityRef`, `fieldRef`, `codecRef`, `list`, `map`, `record`, `oneOf`, `funcCall`/`funcCallFrom`), `AttributeSpec`, the three constructors (`fieldAttribute`/`modelAttribute`/`blockAttribute`), `interpretAttribute`, `InferAttr`, and the `InterpretCtx` contract exist in `psl-parser`, consuming the parser's `ExpressionAst` directly. `@relation` in the **SQL** family is validated and lowered via a spec through `interpretAttribute`, producing byte-identical contract output and identical diagnostics to the hand-written path it replaces.
   - **Builds on:** None.
   - **Hands to:** (a) the kit + `interpretAttribute` + `InferAttr` API exported from `psl-parser`; (b) the `InterpretCtx` wiring recipe — how a family interpreter assembles `SymbolTable` / declaring model / referenced-model resolver / declaring field / codec lookup / default-fn registry at an attribute call site; (c) the migration recipe — route a call site from `readResolvedArgList` + string helpers to `interpretAttribute(cstNode, spec, ctx)`, then retire the now-dead helper.
   - **Focus:** The generic engine and exactly one representative attribute (`@relation` — the richest: positional+named alias, `fieldRef('self')`/`fieldRef('referenced')` scopes, `enumOf` actions, `list` with `nonEmpty`, and a `refine` for the both-or-neither rule). The remaining SQL attributes and all Mongo attributes are deliberately left to slices 2 and 3. No language-server consumer (project non-goal).

### Parallel group A (builds on slice 1; independent of group B)

- **Slice `sql-attributes`** — Linear: _TBD_
  - **Outcome:** Every remaining field-, model-, and block-level attribute the **SQL** family interprets — `@id`/`@@id`, `@unique`/`@@unique`, `@@index`, `@default`, `@map`/`@@map`, `@@control`, `@@discriminator`, `@@base` — is described by a spec and lowered via `interpretAttribute`. The SQL family's hand-written argument-parsing helpers (`psl-attribute-parsing.ts` string parsers, and the per-attribute `getNamedArgument`/`getPositionalArgument` re-parsing in `interpreter.ts`, `psl-field-resolution.ts`, `psl-relation-resolution.ts`) are deleted for every migrated attribute.
  - **Builds on:** Slice 1's kit API + `InterpretCtx` wiring recipe + migration recipe.
  - **Hands to:** SQL family fully spec-driven; no legacy SQL attribute-argument parser remains (grep gate).
  - **Focus:** SQL family only (`packages/2-sql/2-authoring/contract-psl`). The model-level aggregation that enforces cross-attribute rules stays untouched (spec decision); only single-attribute cross-argument rules move into each spec's `refine`. `@db.*` native types remain out of scope.

### Parallel group B (builds on slice 1; independent of group A)

- **Slice `mongo-attributes`** — Linear: _TBD_
  - **Outcome:** Every field-, model-, and block-level attribute the **Mongo** family interprets — `@id`, `@unique`/`@@unique`, `@@index`, `@@textIndex`, `@relation`, `@map`/`@@map`, `@@discriminator`, `@@base` — is described by a spec and lowered via `interpretAttribute`, including the mixed string/number index `type` as a single `enumOf` and the index-element `oneOf`. The Mongo family's hand-written helpers (`psl-helpers.ts` parsers, `parseIndexFieldList`, the local `parseRelationAttribute`) are deleted for every migrated attribute.
  - **Builds on:** Slice 1's kit API + `InterpretCtx` wiring recipe + migration recipe.
  - **Hands to:** Mongo family fully spec-driven; no legacy Mongo attribute-argument parser remains (grep gate).
  - **Focus:** Mongo family only (`packages/2-mongo-family/2-authoring/contract-psl`). Mongo migrates its own `@relation` spec (distinct value shapes from SQL's). The "at most one `@@textIndex` per collection" rule stays in Mongo's existing model-level aggregation, not in a per-attribute `refine` (spec decision).
  - **Carry-in from slice 1 (D6):** `enumOf` was **removed**; enums are now `oneOf` over per-member matchers (`identifier(name)` for bare identifiers; pinned `str(value)` / `num(value)` for literals). Mongo's index `type` set (`1`, `-1`, `"text"`, `"2dsphere"`, `"2d"`, `"hashed"`) becomes `oneOf(num(1), num(-1), str('text'), str('2dsphere'), str('2d'), str('hashed'))`. Slice 1 built `oneOf` + `identifier`; **slice 3 builds the pinned `str(value)` / `num(value)` forms** (their first consumer is this index-type set — digit-leading members like `"2dsphere"` can't be bare identifiers, so they're quoted-string literals).

## Dependencies (external)

- [x] **Linear tracking** — single umbrella issue [TML-2956](https://linear.app/prisma-company/issue/TML-2956) under the _Language Tools Support Prisma Next PSL_ project, assigned to @tatarintsev. (Per-slice sub-issues not yet created; the operator opted for one umbrella ticket over a Linear Project + three sub-issues.)
- [x] **ADR 231 — Declarative attribute specifications** — settled (`Proposed`); this project is its first implementation and advances its status at close-out.

## Sequencing rationale

Slice 1 is the substrate every consumer depends on, so it must land first — this is the migration-shaped "substrate change → consumer migration" pattern, which always serialises at the substrate boundary. `@relation` is folded into slice 1 (rather than a pure kit-only slice) so the slice is *Valuable* on its own: it ships a working consumer and proves the seam end-to-end, not "preparation for slice 2."

Slices 2 and 3 run in parallel because they touch **disjoint family packages** (`packages/2-sql` vs `packages/2-mongo-family`) and share no mutable surface beyond slice 1's already-merged kit — the "different operation families parallelise well" heuristic. Neither consumes the other's hand-off. Serializing them would forfeit throughput the dependency graph permits.
