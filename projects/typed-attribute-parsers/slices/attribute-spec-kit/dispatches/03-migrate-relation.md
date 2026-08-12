# Brief: D3 — migrate SQL `@relation` to a spec; delete `parseRelationAttribute`

> Fresh implementer (session resume is unavailable). Read the context paths first; all prior work is committed.

## Context paths (read before editing)
- **The kit you consume** (committed): `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` — `types.ts` (`ArgType`, `AttributeSpec`, `Param`, `InterpretCtx`, `InferAttr`), `interpret.ts` (`interpretAttribute`), `field-attribute.ts` (`fieldAttribute`), `optional.ts`, `combinators/` (`str`, `enumOf`, `fieldRef`, `list`). All exported from `@internal/psl-parser` (`src/exports/index.ts`).
- **The code you replace:** `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` — `parseRelationAttribute` (the hand-written parser) and `normalizeReferentialAction` (KEEP this — it stays the referential-action validator). Read both in full.
- **The call sites:** `packages/2-sql/2-authoring/contract-psl/src/interpreter.ts` — three `parseRelationAttribute({ attribute, modelName, fieldName, sourceId, diagnostics })` calls (around the `buildModelNodeFromPsl` relation paths). Also `psl-field-resolution.ts` / `psl-relation-resolution.ts` `validateNavigationListFieldAttributes` for surrounding context.
- Slice spec (esp. § Resolved decisions): `projects/typed-attribute-parsers/slices/attribute-spec-kit/spec.md`. ADR 231.
- The interpreter receives `symbolTable: SymbolTable` + `sourceFile: SourceFile` (see `InterpretPslDocumentToSqlContractInput`) — so the CST attribute node and everything `InterpretCtx` needs is in reach. Diagnostics here are `ContractSourceDiagnostic` (`{ code, message, sourceId, span }`); `PslDiagnostic` has the same shape — map between them at the call site as needed.

## Task
Replace the hand-written `parseRelationAttribute` with a declarative `sqlRelation` `AttributeSpec` lowered through `interpretAttribute`, preserving **byte-identical diagnostic codes and spans** for every `@relation` error path (message text may change per the project parity bar). Then delete `parseRelationAttribute` and any helper it alone used.

### The spec
Define `sqlRelation` (e.g. in a new `src/attribute-specs.ts` or co-located in `psl-relation-resolution.ts`):
```
fieldAttribute('relation', {
  positional: [{ key: 'name', type: optional(str()) }],   // positional-or-named alias for name
  named: {
    name:       optional(str()),
    fields:     optional(list(fieldRef('self'),       { nonEmpty: true })),
    references: optional(list(fieldRef('referenced'), { nonEmpty: true })),
    map:        optional(str()),
    onDelete:   optional(<bare-identifier-name leaf>),
    onUpdate:   optional(<bare-identifier-name leaf>),
  },
  refine: relationInvariants,
  diagnosticCode: 'PSL_INVALID_RELATION_ATTRIBUTE',
})
```
- **`onDelete`/`onUpdate` (resolved decision):** these are **bare identifiers** (`onDelete: Cascade`), and the action set is validated **downstream** by the existing `normalizeReferentialAction` (which emits `PSL_UNSUPPORTED_REFERENTIAL_ACTION`). Do NOT use `enumOf` for them (it would change the code at parse time and break parity). Parse them to the **raw identifier name string** (no set check) and route the result to `normalizeReferentialAction` unchanged. If the kit has no bare-identifier-name leaf, add a small one in `psl-parser` combinators (reads an `IdentifierAst` → its name, no validation; analogous to `fieldRef` minus the scope) and export it; unit-test it.
- **`refine: relationInvariants`** holds the cross-argument rules: `fields`/`references` both-or-neither (legacy code `PSL_INVALID_RELATION_ATTRIBUTE`, anchored to the attribute span). The positional-vs-named `name` conflict is handled by the **engine's alias mechanism** (already built) — verify it emits with `diagnosticCode` + attribute-span; if its span/anchoring diverges from legacy, reconcile.
- The interpreted output (`InferAttr<typeof sqlRelation>` = `{ name?, fields?, references?, map?, onDelete?, onUpdate? }`) is mapped at the call site to today's `ParsedRelationAttribute` (`name → relationName`, `map → constraintName`, rest 1:1).

### InterpretCtx assembly
At each call site, build an `InterpretCtx` from interpreter state: `level: 'field'`, `sourceId`, `sourceFile`, `symbols` (the SymbolTable), `selfModel` (the declaring model symbol), `resolveReferencedModel()` (the relation's target model — use the field's type name to resolve, as the interpreter already does elsewhere), optional `field`, and a baseline `diagnosticCode` (the engine overrides it from the spec). Factor the assembly into a small helper if it's repeated across the three call sites.

## Parity reconciliation (the load-bearing carry-overs)
Verify against the diagnostics + relations fixtures/tests and reconcile:
1. **Codes + spans byte-identical** for every `@relation` error path: positional-name-not-a-string, named-name-not-a-string, conflicting names, unknown argument, fields-xor-references, empty/non-bracketed fields or references, map-not-a-string, too-many-positional, bad referential action. For each, confirm the legacy code + span are reproduced. Where the engine anchors a span differently than legacy, prefer adjusting the spec/call-site; a minimal, noted engine span tweak is acceptable only if unavoidable.
2. **Aggregate-all vs first-error:** the engine returns ALL diagnostics; legacy returned on the FIRST error (then the caller skipped the field). If a fixture has a `@relation` with multiple simultaneous errors, the diagnostic SET may grow. If you find such a case, **halt and surface** the specific fixture delta rather than silently rewriting it — the orchestrator decides whether the richer diagnostics are an acceptable, intentional fixture update.
3. **Duplicate named args:** the engine silently drops duplicates (no diagnostic). Confirm this matches legacy `@relation` behaviour (legacy used `getNamedArgument` = first match) or that the upstream parser already rejects duplicates. Note the finding.

## Scope
**In:** `sqlRelation` spec; route the three `@relation` call sites through `interpretAttribute` + map the output to `ParsedRelationAttribute`; `InterpretCtx` assembly helper; delete `parseRelationAttribute` and any now-dead helper it alone used (check `getPositionalArgumentEntry`, `parseFieldList`, etc. — delete only if `@relation` was their sole caller; otherwise leave for slice 2); add the bare-identifier-name leaf to `psl-parser` if needed. Keep `normalizeReferentialAction`.
**Out:** all other SQL attributes (`@id`, `@unique`, `@@index`, `@default`, `@map`, `@@control`, `@@discriminator`, `@@base`) — slice 2; Mongo — slice 3; the rest of ADR 231's alphabet; `@db.*`.

## Completed when
- [ ] `@relation` is validated + lowered via `interpretAttribute(sqlRelation)`; `parseRelationAttribute` deleted.
- [ ] `rg "parseRelationAttribute"` returns zero results (outside this brief's own text).
- [ ] Diagnostic **codes + spans** byte-identical for every `@relation` error path (verified against `interpreter.relations.test.ts`, `interpreter.relations.many-to-many.test.ts`, `interpreter.diagnostics.test.ts`).
- [ ] Gate green: `pnpm --filter @internal/contract-psl-sql test` (or the package's actual name — confirm via its `package.json`); `pnpm fixtures:check`; and after `pnpm --filter @internal/psl-parser build`, a workspace `pnpm typecheck` (cross-package consumer check, since `psl-parser`'s exported types changed). `pnpm --filter @internal/psl-parser test` + lint if you added the bare-identifier leaf.

## Standing instruction
Stay focused on the goal; control scope. Trivial-and-related fixes serving the goal go in with a one-line note; anything pulling you off the goal — especially migrating a second attribute — halts and surfaces.

## Constraints
- No `any`; no bare `as` (narrow `blindCast`/`castAs` with reason, or types that avoid it); no file-extension imports; no reexport outside `exports/`; tests-first where you add new kit surface.
- Explicit-staging commits, no amend, **no push**. Read-only on `projects/typed-attribute-parsers/reviews/**`, `spec.md`, plan files. Run the transient-ID scan on your `+` diff.

## Operational metadata
- **Model tier:** thorough (parity-critical, judgment-heavy migration across packages).
- **Halt conditions:** a fixture's `@relation` diagnostic SET changes (aggregate-all case — surface it, decision #2 above); a span can't be reproduced without a non-trivial engine change; deleting a helper would break a non-`@relation` caller (leave it, note it for slice 2); the diff drifts into a second attribute.

Return the structured report per § Return shape; explicitly report the parity verification (each error path: code + span identical?), the duplicate-named-arg finding, and any fixture delta you surfaced.
