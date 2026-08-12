# typed-attribute-parsers

## Purpose

Give every PSL attribute a single declarative description that the family interpreters read to validate and lower its arguments, so that "what an attribute accepts" lives as inspectable data in one place instead of as hand-written parsing code duplicated across the SQL and Mongo interpreters. The why is permanence-of-knowledge: the same description must later be readable by other consumers (the language server) without re-deriving it — this project earns that by making the interpreter the first consumer.

## At a glance

Today each interpreter pulls raw argument text out of the AST and re-checks its shape by hand. `@relation`'s `fields` argument is a string that gets `split(',')`; `onDelete` is a string compared against a literal list; an unknown named argument is rejected by ad-hoc code — the same patterns repeated in slightly different ways across `packages/2-sql/.../interpreter.ts` (2155 lines) and the Mongo interpreter, backed by string helpers like `parseFieldList` and `parseQuotedStringLiteral`.

This project replaces that with one declarative `AttributeSpec` per attribute, composed from a fixed kit of argument combinators (ADR 231), and a single `interpretAttribute(node, spec, ctx)` that returns a strongly-typed object whose shape is **inferred from the spec** (`InferAttr<S>`) — or structured diagnostics.

```
// before — hand-written, per attribute, per family
const raw = getNamedArgument(attr, 'fields');          // string
const fields = parseFieldList(raw);                     // split(',') + trim
const onDelete = normalizeReferentialAction(getNamedArgument(attr, 'onDelete'));
// … unknown-argument rejection, span anchoring, both-or-neither rule, all by hand

// after — one description the interpreter reads
const sqlRelation = fieldAttribute('relation', {
  positional: [{ key: 'name', type: optional(str()) }],
  named: {
    fields:     optional(list(fieldRef('self'),       { nonEmpty: true })),
    references: optional(list(fieldRef('referenced'), { nonEmpty: true })),
    onDelete:   optional(enumOf('NoAction', 'Restrict', 'Cascade', 'SetNull', 'SetDefault')),
    onUpdate:   optional(enumOf('NoAction', 'Restrict', 'Cascade', 'SetNull', 'SetDefault')),
    map:        optional(str()),
  },
  refine: relationInvariants,   // fields + references are both-or-neither
});
const parsed = interpretAttribute(relationNode, sqlRelation, ctx);  // typed result | diagnostics
```

The emitted contract is unchanged; what changes is how the interpreter arrives at it. The output type is derived from the spec, so it cannot drift from the validation.

## Non-goals

- **Language-server integration.** Completion, go-to-definition, find-usages, and hovers over attribute arguments are the follow-up that this project's specs are designed to enable, but no language-server consumer is built here. Specs must carry the structure those features need (reference scopes, enum value sets), but wiring them into the editor is out of scope.
- **`@db.*` native types.** These are attributes on named-type declarations, not on fields or models, and are handled by a separate resolver path (ADR 231 § Out of scope). Untouched.
- **The TypeScript builder authoring surface.** Attributes are a PSL-only concept; the TS builders never use them. No combinator appears in the builder API.
- **New attribute syntax or new attributes.** This project re-expresses the *existing* attribute surface as specs; it does not add, remove, or change which attributes or argument shapes are accepted.
- **Generic-block `key = value` parameters and enum member values.** ADR 231 floats unifying these with the kit as an open question; this project does not pursue it.

## Place in the larger world

- **ADR 231 — Declarative attribute specifications** is the architectural driver; this project is its first (interpreter-only) implementation. The ADR is `Proposed`; this project's close-out should move it toward `Accepted` or record divergences.
- **The combinator kit lives in `psl-parser`** (`packages/1-framework/2-authoring/psl-parser`) — the PSL authoring-layer package that already owns the parser, the `ExpressionAst` CST, and the `SymbolTable`. It is not in the target-agnostic framework core, because attributes are PSL-specific. `psl-parser` exports the kit, `AttributeSpec`, `interpretAttribute`, and `InferAttr` alongside its existing AST exports.
- **The two consumers** are the family interpreters: `packages/2-sql/2-authoring/contract-psl` and `packages/2-mongo-family/2-authoring/contract-psl`. Each contributes the specs for the attributes it understands, registered by `(level, name)`; the kit dispatches generically and never learns an attribute's name (the ADR-225 contribution model).
- **Argument representation.** Combinators parse the parser's `ExpressionAst` directly — the CST union (`ArrayLiteralAst`, `ObjectLiteralExprAst`, `StringLiteralExprAst`, `FunctionCallAst`, …) that `psl-parser` already exports, which carries native `[…]` / `{…}` literals and real spans. No new intermediate argument representation is introduced. The migration routes each interpreter call site away from the string-flattened `ResolvedAttribute` (`readResolvedArgList`, which collapses arguments to `value: string`) and toward passing the CST attribute node (`FieldAttributeAst` / `ModelAttributeAst`) into `interpretAttribute`. The interpreter already receives the `SymbolTable` and `SourceFile` rather than a pre-flattened document, so the CST is in reach at every call site.
- **Resolution context.** Reference combinators draw on an `InterpretCtx` carrying the parser's `SymbolTable`, the declaring model, a referenced-model resolver, the declaring field (field level only), a codec lookup, and the default-function registry — all already present in the interpreters' existing wiring.

## Cross-cutting requirements

- **Behavioural parity, end to end.** For every attribute migrated, the interpreter produces the identical contract output and identical diagnostic **codes** it produced before. Diagnostic **spans** must be **no coarser** than before — narrower/more-precise spans (the natural result of the kit's per-argument anchoring, per ADR 231's native-literal-spans benefit) are acceptable; widening a span is not. Diagnostic **message text** may change to the combinator kit's phrasing, provided each message stays clear and actionable. Malformed inputs that legacy tolerated by coincidence (e.g. a quoted referential action `onDelete: "Cascade"`) may be rejected by the stricter typed leaves. `pnpm fixtures:check` and the interpreter test suites are the parity gate; no contract-output or diagnostic-code drift is acceptable without an explicit, reviewed rationale. _(Messages-may-change + spans-no-coarser + stricter-malformed-rejection relaxations authorised by operator, 2026-06-29.)_
- **The spec is the only source of an attribute's argument shape.** Once an attribute is migrated, no hand-written argument-parsing path for it remains. Its output type is `InferAttr<S>`, not a separately maintained interface.
- **Leaf parsing is pure.** A combinator returns diagnostics in a `Result`, never into a shared sink, so `oneOf` can try and discard branches cleanly. No combinator mutates a diagnostics array passed by reference.
- **Generic dispatch.** The kit and `interpretAttribute` never branch on a specific attribute name; families register specs and the engine dispatches structurally.

## Transitional-shape constraints

- **Every slice keeps CI green on `main`** — `pnpm typecheck`, `pnpm lint`, `pnpm test:packages`, and `pnpm fixtures:check` all pass at every merge.
- **Incremental, attribute-by-attribute migration.** Specs and hand-written parsing coexist while the migration is in flight; the interpreter may route some attributes through specs and others through legacy code simultaneously. A slice migrates a coherent group of attributes (e.g. all of `@relation`) and deletes the legacy path for exactly that group — never leaving two live validation paths for the same attribute.
- **`interpretAttribute` and the kit land with the first migrated attribute**, leaving the existing `ResolvedAttribute` string-flattening path (`readResolvedArgList` and the string helpers) in place for every not-yet-migrated attribute, so legacy parsing keeps working until its attribute is migrated. Those legacy paths are deleted only when their last caller is migrated.

## Project Definition of Done

- [ ] Team-DoD floor items (inherited from [`drive/calibration/dod.md`](../../drive/calibration/dod.md) — repo-wide gates, doc/migration, Linear close-out, manual-QA roll-up, ADR audit).
- [ ] The combinator kit, `AttributeSpec`, `interpretAttribute`, and `InferAttr` exist in `psl-parser` (exported alongside its existing AST exports) with unit tests covering each combinator's parse + diagnostic behaviour.
- [ ] Every field-, model-, and block-level attribute interpreted by the **SQL** family is described by a spec and lowered via `interpretAttribute`; the corresponding hand-written argument-parsing helpers are deleted.
- [ ] Every field-, model-, and block-level attribute interpreted by the **Mongo** family is described by a spec and lowered via `interpretAttribute`; the corresponding hand-written argument-parsing helpers are deleted.
- [ ] `pnpm fixtures:check` is clean and the SQL + Mongo interpreter test suites pass with no diagnostic-parity regressions.
- [ ] No remaining caller of the removed string helpers (`parseFieldList`, `parseAttributeFieldList`, per-attribute `getNamedArgument`/`getPositionalArgument` re-parsing) for any migrated attribute; a grep gate confirms this.
- [ ] ADR 231 updated to reflect what shipped (status advanced and/or divergences recorded).

### Contract-impact

The **emitted contract is unchanged** — this is a refactor of how interpreters validate arguments, gated by `fixtures:check`. There is no new argument representation: combinators consume the existing `ExpressionAst` CST. The internal change is that migrated interpreter call sites stop flattening attributes to `ResolvedAttribute` strings and instead pass CST attribute nodes into `interpretAttribute`. `ResolvedAttribute` / `readResolvedArgList` and the string helpers remain until their last caller is migrated, then are deleted.

### Adapter-impact

No `packages/3-targets/**` adapter is touched. The interpreters being migrated live in the family **authoring** layer (`packages/2-sql`, `packages/2-mongo-family`), upstream of the target adapters; adapter behaviour is reached only through the unchanged contract.

## Resolved decisions

- **Argument representation — `ExpressionAst`, no intermediate form.** Combinators consume the parser's `ExpressionAst` CST directly. No `PslArgAst` or other intermediate value is introduced. (Folded into _Place in the larger world_ and _Contract-impact_.)
- **Kit package — inside `psl-parser`.** The kit, `AttributeSpec`, `interpretAttribute`, and `InferAttr` ship from `psl-parser`, which already owns `ExpressionAst` and the `SymbolTable`. No new package.
- **Migration ordering — deferred to planning.** Which attribute groups become slices, and in what order, is a `drive-plan-project` concern, not a spec-level decision.
- **`refine` vs. model-level aggregation — single-attribute rules only.** A single-attribute cross-argument rule — `@relation`'s "`fields` and `references` are both-or-neither" — is implemented as the spec's `refine(parsed, ctx)` callback: a function that runs *after* every argument has parsed, receives the fully-typed result object, and returns diagnostics that no single combinator could produce (each combinator sees only its own argument). That is what "the rule lives in `refine`" means — it is a field on the `AttributeSpec`, not inline interpreter code. A rule that spans *several attributes on one model* — "at most one `@@textIndex` per collection" — is not attribute-level and stays in the existing model-level aggregation that runs above the individual `interpretAttribute` calls. Decision: move single-attribute cross-argument rules into `refine`; build no new aggregator and leave today's model-level checks untouched.

## Open Questions

None — design settled. Migration sequencing is handed to `drive-plan-project`.

## References

- ADR 231 — [Declarative attribute specifications](../../docs/architecture%20docs/adrs/ADR%20231%20-%20Declarative%20attribute%20specifications.md) (the architectural driver; advance its status at close-out).
- ADR 225 — Three-layer extensibility for pack-contributed entity kinds (the contribution/registration model the kit follows).
- ADR 224 — Control policy: framework-locked vocabulary, family-owned dispatch (the `@@control` value set this kit types as `enumOf(...)`).
- ADR 221 — Contract IR: uniform entity coordinate (the coordinate model reference combinators write into).
- Current interpreters: `packages/2-sql/2-authoring/contract-psl/src/interpreter.ts`, `packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts`.
- Current arg flattening: `packages/1-framework/2-authoring/psl-parser/src/resolve.ts` (`readResolvedArgList`); string helpers in `packages/2-sql/2-authoring/contract-psl/src/psl-attribute-parsing.ts`.
- Linear issue: [TML-2956](https://linear.app/prisma-company/issue/TML-2956) (under project _Language Tools Support Prisma Next PSL_, Terminal team).
