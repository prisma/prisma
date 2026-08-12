# Slice: attribute-spec-kit

_(In-project slice. Parent: `projects/typed-attribute-parsers/`. Outcome it contributes: stands up the declarative-attribute engine the whole project builds on, proven by one real attribute.)_

## At a glance

Build the combinator kit + `interpretAttribute` + `InferAttr` + `InterpretCtx` in `psl-parser`, and migrate the SQL family's `@relation` from the hand-written `parseRelationAttribute` (in `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`) to a declarative `AttributeSpec` lowered through `interpretAttribute`. After this slice, `@relation` (SQL) is validated and lowered via a spec, and the engine + the combinators `@relation` needs exist for slices 2–3 to consume.

## Chosen design

The engine consumes the parser's `ExpressionAst` CST directly (already exported from `psl-parser`). An `ArgType<T>` parses one argument; an `AttributeSpec` lists positional params + named params + an optional `refine`; `interpretAttribute(attrNode, spec, ctx)` returns `Result<InferAttr<S>, Diagnostic[]>`.

The SQL `@relation` spec replaces `parseRelationAttribute`:

```ts
const sqlRelation = fieldAttribute('relation', {
  positional: [{ key: 'name', type: optional(str()) }],   // positional-or-named alias for `name`
  named: {
    name:       optional(str()),
    fields:     optional(list(fieldRef('self'),       { nonEmpty: true })),
    references: optional(list(fieldRef('referenced'), { nonEmpty: true })),
    map:        optional(str()),
    onDelete:   optional(enumOf('NoAction', 'Restrict', 'Cascade', 'SetNull', 'SetDefault')),
    onUpdate:   optional(enumOf('NoAction', 'Restrict', 'Cascade', 'SetNull', 'SetDefault')),
  },
  refine: relationInvariants,   // fields/references both-or-neither; positional/named name conflict
});
```

`interpretAttribute(relationNode, sqlRelation, ctx)` yields the same shape `ParsedRelationAttribute` carries today (`{ relationName?, fields?, references?, constraintName?, onDelete?, onUpdate? }`), mapped at the call site. `InterpretCtx` is assembled from data the SQL interpreter already holds (symbol table, declaring model, referenced-model resolver, declaring field, source id).

**Minimal kit, grown by consumers.** Slice 1 ships the engine plus only the combinators `@relation` needs — `str`, `enumOf`, `fieldRef(scope)`, `list({ nonEmpty })`, `optional`, `fieldAttribute`. The rest of ADR 231's alphabet (`int`, `bool`, `json`, `map`, `record`, `entityRef`, `codecRef`, `oneOf`, `funcCall`/`funcCallFrom`, `modelAttribute`, `blockAttribute`) is added by slices 2–3 as the attributes they migrate require it. This keeps slice 1 reviewable.

## Coherence rationale

One reviewer holds it in one sitting: a new authoring surface (`psl-parser` kit) plus its first consumer (`@relation`), reviewed together so the engine is judged against a real attribute rather than in the abstract. The legacy `parseRelationAttribute` is deleted in the same PR, so there is never a second live validation path for `@relation`.

## Scope

**In:**
- `psl-parser`: `ArgType`, `AttributeSpec`, `Param`/`optional`, `fieldAttribute`, `interpretAttribute`, `InferAttr`, `InterpretCtx`, and the combinators `str`, `enumOf`, `fieldRef`, `list` — with unit + type-level tests; exported from `psl-parser`'s public surface.
- `packages/2-sql/2-authoring/contract-psl`: `sqlRelation` spec; route the `@relation` call sites in `interpreter.ts` / `psl-relation-resolution.ts` through `interpretAttribute`; assemble `InterpretCtx`; delete `parseRelationAttribute` (and any now-dead helpers it alone used).

**Out:**
- All other SQL attributes (`@id`, `@unique`, `@@index`, `@default`, `@map`, `@@control`, `@@discriminator`, `@@base`) — slice 2.
- All Mongo attributes — slice 3.
- The unused-by-`@relation` combinators (`int`, `bool`, `json`, `map`, `record`, `entityRef`, `codecRef`, `oneOf`, `funcCall`, `modelAttribute`, `blockAttribute`).
- Language-server consumers; `@db.*`; the TS builder surface.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| Positional + named `name` both present and disagreeing | Must preserve | Existing code emits `PSL_INVALID_RELATION_ATTRIBUTE` "conflicting positional and named relation names"; reproduce via `refine` or the alias merge. |
| `fields` without `references` (or vice-versa) | Must preserve | Existing both-or-neither check, code `PSL_INVALID_RELATION_ATTRIBUTE`; lives in `refine`. |
| Unknown named argument (e.g. `@relation(foo: 1)`) | Must preserve | Existing code rejects with `PSL_INVALID_RELATION_ATTRIBUTE`; the engine's named-map closedness must reject it (see Open Question on message text). |
| `onDelete`/`onUpdate` value not in the action set | Must preserve code | Today `PSL_UNSUPPORTED_REFERENTIAL_ACTION` is raised *downstream* by `normalizeReferentialAction`, not at parse; decide whether `enumOf` raises at parse with the same code or the value passes through to the existing normaliser. |

## Slice-specific done conditions

- [ ] `rg "parseRelationAttribute"` returns zero results outside its deleted definition.
- [ ] `pnpm fixtures:check` clean and the SQL interpreter relations suites pass (`interpreter.relations.test.ts`, `interpreter.relations.many-to-many.test.ts`, `interpreter.diagnostics.test.ts`).
- [ ] Diagnostic **codes and spans** for every `@relation` error path are byte-identical to pre-slice behaviour. Message text may change to the kit's phrasing (see Resolved decision 1) but must stay clear and actionable; updated test assertions are reviewed as intentional.

## Resolved decisions

1. **Diagnostic-message parity — codes + spans only (operator-authorised, 2026-06-29).** Codes + spans are the hard parity gate. Cross-argument messages emitted from hand-written `refine` (both-or-neither, name-conflict) should stay close to the existing text, but generic-combinator-emitted messages (unknown-arg, malformed-list, bad-enum-value) may adopt the kit's phrasing as long as they remain clear. Affected interpreter-test message assertions are updated as intentional, reviewer-approved changes. The engine does **not** need subject-label message-templating in slice 1. This relaxes the project's original "identical messages" cross-cutting requirement, which has been amended accordingly.

## Resolved decisions (cont.)

2. **`onDelete`/`onUpdate` keep `normalizeReferentialAction` as validator (resolved at D3).** `onDelete: Cascade` is a **bare identifier**, and legacy validates the action set *downstream* via `normalizeReferentialAction`, emitting `PSL_UNSUPPORTED_REFERENTIAL_ACTION`. Using `enumOf` (set-validation at parse) would change that code and break the codes-parity bar. So the `sqlRelation` spec parses `onDelete`/`onUpdate` to the **raw identifier name** (a bare-identifier leaf, no parse-time set check) and routes the value to the existing `normalizeReferentialAction` unchanged — exact code/span/message parity. `enumOf` is NOT used for `@relation` actions (it remains for slices 2–3). D3 adds the small bare-identifier-name leaf if one isn't already present.

## Open Questions

None — all resolved.

## References

- Parent project: `projects/typed-attribute-parsers/spec.md`
- Linear issue: [TML-2956](https://linear.app/prisma-company/issue/TML-2956)
- ADR 231 — `docs/architecture docs/adrs/ADR 231 - Declarative attribute specifications.md`
- Legacy parser being replaced: `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (`parseRelationAttribute`, `normalizeReferentialAction`)
- Engine input type: `ExpressionAst` and friends, exported from `packages/1-framework/2-authoring/psl-parser/src/exports/syntax.ts`
