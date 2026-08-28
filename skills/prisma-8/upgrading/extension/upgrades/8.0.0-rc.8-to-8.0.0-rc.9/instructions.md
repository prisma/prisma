---
from: "8.0.0-rc.8"
to: "8.0.0-rc.9"
changes:
  - id: remove-nested-relations-from-sql-orm-upsert-and-batch-create
    summary: |
      SQL ORM `upsert({ create })`, `createAll()`, and `createAndCount()` payloads no longer accept nested relation mutation callbacks, which these operations cannot execute. Remove the callbacks and create related records separately, or use ordinary `create()` when the records must be created as one nested relation operation.
  - id: namespace-qualify-sql-orm-filter-types
    summary: |
      SQL ORM reusable filter types now require the domain namespace before the model name: `<Contract, Namespace, Model>`.
  - id: add-attributes-to-psl-extension-block-literals
    summary: |
      `PslExtensionBlock` gained a required `attributes` record (attribute name → `{ args, span }`, the kit-parsed values of the block's `@@` attributes). Every hand-built block node — synthesised blocks in scripts, inference builders, and test fixtures — must set `attributes` next to `blockAttributes` (`{}` when the block carries no attributes).
    detection:
      glob: "**/*.{ts,tsx}"
      contains:
        - "blockAttributes:"
      anyMatch: true
  - id: read-native-enum-map-failures-from-the-kit
    summary: |
      `PSL_NATIVE_ENUM_INVALID_MAP` no longer exists. A malformed `@@map` on a `native_enum` block — and every other malformed block attribute — is reported at symbol-table time as `PSL_INVALID_ATTRIBUTE_SYNTAX`; only the policy `@@map("")` empty-name rule keeps its own code (`PSL_POLICY_INVALID_MAP`). Replace references to the removed code and assert those diagnostics on the `buildSymbolTable` result rather than on the interpretation result.
    detection:
      glob: "**/*.{ts,tsx}"
      contains:
        - "PSL_NATIVE_ENUM_INVALID_MAP"
      anyMatch: true
  - id: arg-type-parse-is-a-property
    summary: |
      `ArgType.parse` is now a property function type carrying a `Ctx` parameter (`ArgType<T, Ctx extends BlockInterpretCtx = InterpretCtx>`), so the ctx an argument type needs is checked contravariantly. A class that implements `ArgType` with a `parse(...)` method, or an object typed against `ArgType<T>` and used inside `blockAttribute()`, must declare `parse` as a function-typed property over the ctx it actually reads (`BlockInterpretCtx` when it never touches `selfModel`).
    detection:
      glob: "**/*.{ts,tsx}"
      contains:
        - "implements ArgType"
        - "ArgType<"
      anyMatch: true
---

# 8.0.0-rc.8 → 8.0.0-rc.9 — Extension author upgrade instructions

## `remove-nested-relations-from-sql-orm-upsert-and-batch-create`

Find SQL ORM calls to `upsert()`, `createAll()`, and `createAndCount()` whose create payloads contain relation fields assigned callback functions. Remove those callbacks and create the related records separately. When the operation requires nested relation creation, replace it with ordinary `create()`, which continues to accept and execute relation mutation callbacks.

## `namespace-qualify-sql-orm-filter-types`

Find TypeScript references to `ShorthandWhereFilter`, `RelationPredicate`, `RelationPredicateInput`, and `RelationFilterAccessor`. Add the model's domain namespace as the second generic argument and place the model name third. Rewrite `ShorthandWhereFilter<Contract, Model>` as `ShorthandWhereFilter<Contract, Namespace, Model>` and `ShorthandWhereFilter<Contract, Model, Namespace>` as `ShorthandWhereFilter<Contract, Namespace, Model>`. Rewrite the relation types from `<Contract, Model>` to `<Contract, Namespace, Model>`. For predicates targeting a relation, use the namespace declared by that relation's `to.namespace` coordinate.

## `add-attributes-to-psl-extension-block-literals`

Find every object literal typed as `PslExtensionBlock` (they carry `kind`, `keyword`, `name`, `parameters`, `blockAttributes`, `span`). Add `attributes` beside `blockAttributes`. A block with no `@@` attributes takes `attributes: {}`. A block synthesised with a `blockAttributes` entry takes the parsed shape of that entry, keyed by attribute name with the spec's positional keys as `args` — for example a synthesised `@@map("x")` on a `policy_*` or `native_enum` block becomes `attributes: { map: { args: { name: 'x' }, span } }`. Consumers that read a block attribute read `block.attributes[name]?.args`, never `block.blockAttributes`.

## `read-native-enum-map-failures-from-the-kit`

Delete every reference to `PSL_NATIVE_ENUM_INVALID_MAP`. Where a test asserted that code after interpreting a document, parse the document and assert `PSL_INVALID_ATTRIBUTE_SYNTAX` on the diagnostics `buildSymbolTable` returns instead; interpretation no longer sees a malformed block attribute. A `@@map(foo)` argument reports `Expected a string literal`; a missing argument reports `Attribute "map" is missing required argument "name"`.

## `arg-type-parse-is-a-property`

Find classes declaring `implements ArgType<…>` with a `parse(arg, ctx)` method and object literals typed against `ArgType<T>`. Declare `parse` as a property whose type is `(arg: ExpressionAst, ctx: Ctx) => Result<T, readonly PslDiagnostic[]>`. Pick `Ctx = BlockInterpretCtx` when the implementation reads only `sourceId` / `sourceFile` (this makes the argument type usable inside `blockAttribute()` specs); keep the default `InterpretCtx` when it reads `selfModel` or `resolveReferencedModel()`. Dispatch on the syntax node with `XAst.cast(arg.syntax)` rather than `arg instanceof XAst` so the argument type keeps working when the spec and the parser come from different module copies.
