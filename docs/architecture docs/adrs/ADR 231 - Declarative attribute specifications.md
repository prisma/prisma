# ADR 231 — Declarative attribute specifications: composable argument combinators with typed inference

**Status:** Proposed
**Date:** 2026-06-29

---

## At a glance

A PSL attribute carries arguments — positional, named, or both. Two parts of the system need to understand those arguments, and today neither can share what it knows with the other.

Each database family's interpreter validates attributes with hand-written code that pulls raw argument text out of the AST, checks shapes, and reports diagnostics — the same patterns (parse a quoted string, split a bracketed list, reject an unknown named argument) repeated across the SQL and Mongo interpreters in slightly different ways. The **language server**, which powers editor features over PSL, has no description of attribute arguments at all. Attribute arguments are **opaque** to it: it cannot complete an argument name, offer the allowed values of `onDelete`, or jump from a field reference inside `@relation(fields: [...])` to the field it names. The knowledge exists — encoded in the interpreters' validation code — but in a form no other consumer can read.

This ADR replaces that with a single declarative description per attribute, designed to be read by every consumer that needs it: the family interpreters that validate and lower attributes, and the language server that offers completion, go-to-definition, and find-usages over them. An author writes a relation like this:

```prisma
model Post {
  authorId Int
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

The framework describes `@relation` once, as data:

```ts
const sqlRelation = fieldAttribute('relation', {
  positional: [{ key: 'name', type: optional(str()) }],
  named: {
    name:       optional(str()),
    fields:     optional(list(fieldRef('self'),       { nonEmpty: true })),
    references: optional(list(fieldRef('referenced'), { nonEmpty: true })),
    map:        optional(str()),
    onDelete:   optional(oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault'))),
    onUpdate:   optional(oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault'))),
  },
  refine: relationInvariants,
});
```

At runtime, `interpretAttribute(node, sqlRelation, ctx)` turns the parsed AST node into a strongly-typed object — or a list of diagnostics. The output type is **inferred from the spec**, with no separate type declaration:

```ts
// InferAttr<typeof sqlRelation>
{
  name?: string;
  fields?: string[];        // resolved against our model's fields
  references?: string[];    // resolved against the referenced model's fields
  map?: string;
  onDelete?: 'NoAction' | 'Restrict' | 'Cascade' | 'SetNull' | 'SetDefault';
  onUpdate?: 'NoAction' | 'Restrict' | 'Cascade' | 'SetNull' | 'SetDefault';
}
```

Notice three things that the rest of this document builds up. The argument value types (`str()`, `oneOf(identifier(...))`, `list(fieldRef('self'))`) are **combinators** drawn from a fixed framework kit. A combinator like `fieldRef` carries a **scope** that says which entity a field name resolves against. And cross-argument rules that no single argument can express — `fields` and `references` must appear together — live in a `refine` step.

That same spec is what the language server reads. Because `onDelete` is declared as `oneOf(identifier('NoAction'), ...)`, the editor enumerates the alternatives' pinned values; because `fields` is declared as `list(fieldRef('self'))`, the editor knows each entry names a field of the model and can resolve it to a definition or find its other uses — none of which the interpreter's hand-written validation could ever expose.

The design covers the full spectrum of the current field-, model-, and generic-block-level attribute syntax.

---

## Decision

Every field-, model-, and generic-block-level attribute is described by a declarative `AttributeSpec` composed from a small, fixed kit of **argument combinators**. A single `interpretAttribute` function consumes a parsed AST node and a spec and returns a strongly-typed object whose shape is **inferred from the spec**, or structured diagnostics. The same spec is consumed by more than the interpreter: it is the description the language server reads to offer completion, go-to-definition, and find-usages over attribute arguments, which today it cannot do because that knowledge lives only as imperative validation code. Attributes are a PSL-only concept; the TypeScript builder authoring surface never uses them. The combinator kit therefore lives in the PSL authoring layer — the same target-agnostic layer that owns the PSL parser and symbol table — not in the framework core. Each family contributes the specs for the attributes it understands, registered by `(level, name)`; that layer dispatches generically and never learns an attribute's name.

The rest of this document develops the design: the principles that shape it, the combinator kit, how positional and named arguments are modelled and typed, how alternatives and function calls compose, the resolution context combinators draw on, cross-argument refinement, and the surface policy for collections. What the design deliberately excludes, and the alternatives weighed against it, are collected at the end.

---

## Design principles

1. **A spec is data, not code.** Each attribute is described declaratively. Validation, type inference, PSL printing, and editor completion all read the same spec rather than re-deriving the attribute's shape.
2. **One description, many consumers.** The interpreters and the language server read the *same* spec. Knowledge about an attribute — what arguments it takes, what their values mean, which arguments name fields or models — is never trapped in one consumer where the others cannot reach it.
3. **The spec is the type.** The strongly-typed result of interpreting an attribute is inferred from its spec (`InferAttr<S>`). There is no hand-written output interface to drift from the validation.
4. **Compose, don't special-case.** Generic `list` / `map` / `record`, a `oneOf` sum, and a recursive `funcCall` replace bespoke leaves like "a list of field references" or "a literal or a function call". New shapes are built by composition.
5. **Native surface by default.** Structured arguments are native PSL literals (`[…]`, `{…}`). Quoted-string-encoded values survive only where they earn it — an arbitrary JSON document — and that exception is isolated in one leaf.
6. **Leaf parsing is pure.** A combinator returns its diagnostics in a `Result` rather than pushing them into a shared sink, so alternatives can be tried and discarded without leaving stray errors behind.
7. **The PSL authoring layer owns the kit; families own the specs.** Attributes are PSL-specific, so the combinator vocabulary lives in the PSL authoring layer rather than the target-agnostic framework core; the attribute set is open and contributed, dispatched structurally.

---

## The combinator kit

An argument combinator is an `ArgType<T>`: it knows how to parse one AST argument into a value of type `T`, and it carries that type at the type level so the output object can be inferred.

```ts
interface ArgType<T> {
  readonly kind: string;   // discriminant for visitor dispatch (print, complete, doc-gen)
  readonly label: string;  // human-readable, for "expected …" diagnostics
  readonly _out?: T;       // phantom; never read at runtime
  parse(arg: PslArgAst, ctx: InterpretCtx): Result<T, Diagnostic[]>;
}
```

The kit divides into four groups.

A combinator owns the work arktype cannot: parsing a PSL AST argument from source, resolving names against the symbol table and registries, anchoring diagnostics to source spans, and carrying the domain metadata (its `kind`, a reference's scope) the language server switches on. Where a leaf reduces to a context-free check on an already-parsed value — a literal, a numeric range, the shape of a JSON object — it delegates that check, and its type inference, to an arktype `Type` it wraps. So a pinned `identifier(name)` / `str(value)` / `num(value)` is backed by an arktype literal, `int({ min, max })` by arktype's numeric constraints, and `json()` by an arktype object schema, while the combinator around them supplies the parse, the context, the spans, and the metadata. This mirrors the existing authoring pattern, where a contributed entity's `validatorSchema` is an arktype `Type` that validates structured input before a factory runs.

**Scalars** read a single token. `str()` parses any quoted string, and `str(value)` pins a specific one. `int({ min, max })` parses a number. `bool()` parses a boolean. `identifier(name)` matches a specific bare identifier, typed `ArgType<name>`, and `num(value)` matches a specific number literal. There is no dedicated enum leaf: a fixed literal set is `oneOf` over these pinned matchers, and because each member is its own matcher the set may be homogeneous *or* mixed — with the quoted-vs-bare surface explicit per member rather than guessed from a value's JS type. Mongo's index `type`, which accepts the numbers `1`/`-1` and the strings `"text"`/`"2dsphere"`/`"2d"`/`"hashed"`, is `oneOf(num(1), num(-1), str('text'), str('2dsphere'), str('2d'), str('hashed'))`. `json()` reads an opaque JSON value from a quoted string; it is the one place a structured value is text-encoded (see [Surface policy](#surface-policy-native-literals-with-one-text-exception)).

**References** resolve a name to an **entity coordinate** — the contract's uniform `(namespace, kind, name)` address for *any* entity, whether a model, an enum, or a pack-contributed entity kind (ADR 221, ADR 224). A reference is not special-cased to models. The coordinate carries one optional extension, a **`field`** element, for a reference that names a field *within* an entity. So `entityRef({ scope })` resolves an entity by name, and its field-bearing form `fieldRef({ scope })` resolves a field within the scoped entity and fills in the coordinate's `field` element; `scope` is `'self'` (the entity declaring the attribute), `'referenced'` (a relation's target entity), or `'document'` (a free path, for wildcard projections). `codecRef()` resolves a registered codec id — a registry reference, not a contract-entity coordinate.

**Generic collections** lift element combinators over native literals. `list(of)` reads a `[…]` array literal into `T[]`, with options `{ nonEmpty, unique }`. `map(key, value)` reads a `{…}` object literal into `Record<K, V>`; `record(value)` is the `map(str(), value)` shorthand. Every collection in the grammar is now a composition rather than a named leaf:

```ts
list(fieldRef('self'),       { nonEmpty: true, unique: true })  // @@id, @@unique field lists
record(str())                                                   // SQL @@index options
map(fieldRef('self'), int())                                    // Mongo @@textIndex weights
```

**Sum and function call** are covered in their own section below, because they introduce alternatives and recursion.

## Positional and named arguments

A spec lists positional parameters in order and named parameters by key. Both write into the same output keyspace, so the inferred object is a flat merge.

```ts
interface PositionalParam<T = unknown> {
  readonly key: string;          // output key this slot writes
  readonly type: Param<T>;
  readonly variadic?: boolean;   // trailing rest, for a list-as-positional
}

interface AttributeSpec<Out> {
  readonly level: 'field' | 'model' | 'block';
  readonly name: string;
  readonly positional: readonly PositionalParam[];
  readonly named: Record<string, Param<unknown>>;
  readonly refine?: (parsed: Out, ctx: InterpretCtx) => Diagnostic[];
}
```

A `Param<T>` is either a bare `ArgType<T>` (required) or `optional(t)` / `optional(t, default)`. Three constructors — `fieldAttribute`, `modelAttribute`, `blockAttribute` — fix the `level` and determine which AST node the interpreter consumes and which context fields are guaranteed present.

Two shapes in the grammar need a note. A **list-as-positional** is an ordinary positional whose type is a `list(...)`: `@@index([a, b])` is one positional bound to `list(indexField())`, and `@@base(Base, "v")` is two fixed positionals. An **alias** is an argument that may be written positionally *or* by name — the relation name is the only case. It is modelled by letting a positional with `key: 'name'` share the output key with the named `name`; the interpreter merges them and reports a conflict if both are present and disagree. The alias is purely about *where the value comes from*; it is unrelated to the `oneOf` combinator below, which is about *what shape a value takes*.

## Type inference

The output type is computed from the spec with mapped types. Optional parameters become optional properties; positional slots contribute their `key`.

```ts
type OutOf<P> =
  P extends Optional<infer T> ? T :
  P extends ArgType<infer T>  ? T : never;

type NamedOut<N extends Record<string, Param<unknown>>> =
  { [K in keyof N as N[K] extends Optional<any> ? never : K]: OutOf<N[K]> } &
  { [K in keyof N as N[K] extends Optional<any> ? K : never]?: OutOf<N[K]> };

type InferAttr<S> = S extends AttributeSpec<any>
  ? Simplify<PosOut<S['positional']> & NamedOut<S['named']>>
  : never;
```

`list`, `map`, and `oneOf` lift through `OutOf` like any other combinator, so a spec built from them infers a precise object type with no separate declaration. Principle #3 — the spec is the type — falls directly out of this.

## Alternatives and function calls

Two combinators express choice and nesting.

`oneOf(...alts)` is a sum: it tries each alternative's `parse` in order and the first success wins; if all fail it emits one `expected <labels>` diagnostic. This works because of principle #6 — each leaf returns its diagnostics in the `Result` rather than pushing them, so a failed branch leaves no trace and `oneOf` can backtrack cleanly. Ordered try-each is chosen over a separate recognition step: it keeps the leaf contract small (one `parse` method, plus a static `label` for the aggregate message). The cost is coarser diagnostics for malformed-but-clearly-intended input, an acceptable trade for a small, closed grammar.

`funcCall(name, sig)` parses a function-call argument. A function call is structurally a named node with its own positional and named arguments — the same shape as an attribute — so `funcCall` **reuses the positional/named argument model recursively**, and its arguments may themselves be any combinator, including a nested `funcCall`. It pins the callee `name` and parses that call's arguments through `sig`; the output carries an `fn` discriminant so a `oneOf` over several functions, or downstream code, can switch on which one matched. An **open, contributed set** of functions — the shape behind PSL default functions — needs no dedicated combinator: it is expressed by composing `oneOf(funcCall(name, sig)…)` over the registered names (principle #4, compose don't special-case).

These two compose the attribute arguments that are neither a plain scalar nor a plain collection. A field default is "a literal that matches the field's type, or one of the default-function registry's calls" — composed per field from the registry:

```ts
const defaultValue = (registry: ControlMutationDefaultRegistry) =>
  oneOf(matchingScalarLiteral(), ...[...registry].map(([name, entry]) => funcCall(name, entry.signature)));
```

`matchingScalarLiteral()` is named to state its contract: it parses a scalar literal *and* checks it against the annotated field's type. It is constructible only inside `fieldAttribute(...)`, where the field is guaranteed in context. A Mongo index element — a bare field, a sorted field, or a wildcard — is likewise a `oneOf`:

```ts
const indexField = () => oneOf(fieldRef('self'), sortedFieldRef('self'), wildcardPath());
```

## Resolution context

Reference and field-typed combinators draw on a single context object threaded through `parse`:

```ts
interface InterpretCtx {
  level: 'field' | 'model' | 'block';
  symbols: SymbolTable;                              // model/field references → their declarations
  selfModel: ModelSymbol;                            // declaring model; for fieldRef('self')
  resolveReferencedModel(): ModelSymbol | undefined; // a relation's target; for fieldRef('referenced')
  field?: ResolvedFieldDescriptor;                   // resolved declaring field; for matchingScalarLiteral
  codecLookup: CodecLookup;                          // for codecRef
  sourceId: string;
}
```

The context holds the parser's `SymbolTable` (and the `ModelSymbol` / `FieldSymbol` it resolves to) rather than a flat `ReadonlySet<string>` of model names. This matters because of the language-server reuse below: a set of names can only confirm that a referenced entity *exists*, but every symbol in the table carries its declaration `span` and AST `node`. So `entityRef()` and `fieldRef()` return a *resolvable* reference — a name plus the site it is declared at — which is what go-to-definition and find-usages need. Holding the symbol table directly is unproblematic here precisely because this machinery is PSL-specific, not part of the target-agnostic framework core; the symbol table is the PSL authoring layer's own type.

`field` is present only at the field level, which is what makes `matchingScalarLiteral()` and the field-default function call type-safe by construction: they are constructible only where the field they validate against is guaranteed available.

## One spec, two consumers: language-server features

The primary reason a spec is *declarative* rather than a parsing function is that a function can only be called — it cannot be inspected. A declarative spec can be read by a second consumer that has no interest in lowering an attribute to a contract: the language server.

Today attribute arguments are opaque to the language server. It can offer little more than the attribute name, because everything past the opening parenthesis is validated by interpreter code it cannot introspect. The same spec the interpreters run answers the questions an editor needs to ask:

- **Autocompletion.** The `named` map lists the legal argument names for an attribute, so the editor completes `fie` to `fields:` inside `@relation(...)`. A value typed `oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault'))` enumerates its alternatives' pinned values, so the editor offers exactly those after `onDelete:`. The combinator's `label` supplies the hover text.
- **Go-to-definition and find-usages.** A combinator declares not just that an argument is a name, but *what kind of name and where it resolves*. `fields: list(fieldRef('self'))` says each entry names a field of the enclosing model; `references: list(fieldRef('referenced'))` says each names a field of the relation's target model; `@@base`'s `entityRef()` names another entity. From that, the language server resolves the symbol under the cursor to its declaration, and finds every other attribute argument that references the same field or entity — neither of which the interpreter's hand-written validation could ever expose, because it discards that structure as soon as it has checked it.
- **Diagnostics parity.** The editor reports the *same* errors the interpreter would, from the same spec, rather than a thinner approximation maintained separately.

This is why the reference combinators carry a **scope** ([resolution context](#resolution-context)) rather than treating every field name alike. The scope is the fact the language server needs to resolve a reference correctly: a name in `references:` must be looked up in the target model, not the local one. Encoding that in the spec is what turns a field reference into a navigable symbol.

## Cross-argument refinement

Some rules span several arguments and cannot be expressed by any single combinator. They live in a `refine(parsed, ctx)` step that runs after every argument parses and sees the fully-typed result. This is where the relation's "`fields` and `references` are both-or-neither" rule lives, along with the SQL index's "`options` requires `type`" and the Mongo index's wildcard, projection, and collation constraints. Rules that span *multiple attributes on one object* — at most one `@@textIndex` per collection — are not attribute-level at all; they belong to a model-level aggregator above the individual specs.

## Surface policy: native literals with one text exception

PSL's expression grammar supports native array and object literals recursively, and the SQL `@@index options` argument already uses a native object literal. Structured arguments therefore use native literals as a rule: `include: [metadata, tags]`, `weights: { title: 10 }`. The one justified exception is a value that is genuinely an arbitrary, nested document the framework does not interpret — a Mongo partial-filter expression — where a JSON string preserves exact fidelity and avoids making the PSL object grammar a JSON superset. That exception is confined to the `json()` leaf used by `filter`; every other collection reads a native literal.

The benefit is uniform: a native literal is parsed by the PSL parser, so it carries real spans and diagnostics and supports editor completion, where a quoted-string-encoded list or map is opaque to all of that.

## Removed storage-type attribute channel

The former `@db.*` named-type attribute channel is removed. Storage types are authored only through type-position constructors: `@db.Uuid` becomes `Uuid`, and `@db.VarChar(191)` becomes `VarChar(191)`. Remaining source that uses the removed spelling receives an actionable diagnostic directing that rewrite. Because storage selection is no longer an attribute surface, this declarative attribute design needs no named-type exception. [ADR 241](ADR%20241%20-%20Scalar%20types%20use%20the%20authoring%20type-constructor%20channel.md) records the unified constructor channel.

---

## Consequences

The validation for an attribute is one declarative value. The patterns that recur across today's interpreters — unwrap a quoted string, split a bracketed list, reject an unknown named argument, resolve a field name against a model — exist once in the combinator kit, not once per attribute per family.

The output type cannot drift from the validation, because there is no separately written output type: `InferAttr<S>` is derived from the same spec the interpreter runs. Adding or renaming an argument changes both at once.

The spec registry is the single source of truth for the attribute surface. The same data that drives validation in the interpreters drives PSL printing, language-server features (completion, go-to-definition, find-usages, hovers), and generated reference documentation. The editor's understanding of an attribute can no longer fall out of step with what the interpreter accepts, because both read one description.

Adding an attribute is additive and local to a family or target: register a new `(level, name)` spec. The framework parser, the interpreter, and the dispatch learn nothing new.

The cost is a new layer of indirection. Reading what an attribute accepts means reading a spec built from combinators rather than imperative code, and contributors must learn the kit. The kit is small and closed, which bounds that cost, but it is a real shift in how attribute logic is read and written.

---

## Alternatives considered

**Keep hand-written validation per attribute.** The status quo: each interpreter parses and checks its attributes directly. Rejected as the thing this ADR exists to replace — it duplicates the same parsing patterns across families, lets the output type drift from the checks, and gives the PSL printer and editor no shared description to read.

**Dispatch `oneOf` with a recognition predicate.** Give each combinator a `recognizes(arg)` method so `oneOf` commits to one branch by AST shape before parsing, yielding more targeted errors. Rejected for now: it doubles the leaf contract (a recognizer that must stay in sync with the parser) for a benefit — sharper errors on malformed input — that a small closed grammar does not need. Ordered try-each over diagnostic-pure branches is simpler, and a recognizer can be added later without changing the leaf contract if error quality demands it.

**A dedicated enum leaf.** A single combinator for a fixed literal set, deciding each member's token surface from its JS type. Rejected in favour of `oneOf` over `identifier` / pinned `str` / `num`: composition (principle #4) expresses homogeneous and mixed sets uniformly, makes the quoted-vs-bare surface explicit per member rather than inferred from a value's type, and reuses the `oneOf` sum the design already needs for `@default` and index elements. Mixed string/number sets — Mongo's index `type` — remain expressible, now as `oneOf(num(1), num(-1), str('text'), …)`.

**`json(codecId)` validated by a codec.** Let the JSON leaf decode through a named codec. Rejected: no attribute in scope needs codec-validated JSON — `filter` is opaque pass-through, and `@@type` takes a codec *id* (a `codecRef`), not a codec-validated value. Codec-bound decoding is a separate concern that belongs to generic-block parameters and enum member values, and if those are folded in later they get their own primitive rather than overloading `json()`.

**Quoted-string surfaces for lists and maps.** Accept `include: "[a, b]"` and `weights: "{…}"` as the encoding. Rejected for everything except an arbitrary document (`filter`): native literals already work, carry spans and diagnostics, and support completion, where quoted strings are opaque. The string surface is kept only where the value is genuinely an uninterpreted JSON document.

**Monomorphic collection leaves.** Bespoke `fieldRefList`, `stringMap`, and the like instead of generic `list` / `map`. Rejected: generic combinators compose the same coverage from fewer pieces (`list(fieldRef('self'))`, `record(str())`), absorb today's ad-hoc checks as list options (`nonEmpty`, `unique`), and let map keys be validated too (`map(fieldRef('self'), int())`).

**Express the whole spec in arktype.** Drop the custom kit and describe each attribute as one arktype `Type`, reusing its validation and type inference. Rejected on three counts that arktype is not built to carry. Its input is a JavaScript value, not a PSL AST with source spans, so parsing surfaces and mini-grammars — and anchoring diagnostics to offsets in the `.prisma` file — fall outside it. Its validation is context-free: a `Type` cannot be handed the symbol table, codec registry, or a field's resolved type, so reference and field-typed combinators would have to rebuild types per document via closures, forfeiting the static, registered-once spec. And, decisively, a reference encoded as an arktype morph is an opaque function to arktype's introspection — the language server could learn "a string that passed a predicate" but never "a reference to a field in the relation's target model," which is the navigable structure this design exists to expose. arktype is therefore used *inside* the value-shape leaves, not as the whole engine.

---

## Open questions

- **Field-type matching is a runtime check.** `matchingScalarLiteral()` validates a literal against the field's type at parse time via `ctx.field`; the static output stays the general default-value union, because the field's concrete type is not known where the spec is defined.
- **Index-element strictness.** Whether `indexField()` should reject unknown modifier keys or values (`field(order: Desc)`, `sort: descending`) rather than silently degrading to ascending. Rejecting is the safer default.
- **Alias ergonomics.** Whether the positional-or-named relation name warrants a first-class `aliased('name')` combinator or stays the positional/named key-collision convention.
- **Generic-block parameters.** Whether the same kit should also type a generic block's `key = value` entries and variadic members (e.g. enum members), unifying extension-block validation with this engine. Codec-bound member decoding would gain its own `codecValue(...)` primitive if so.
- **Collection-level invariants.** Where the model-level aggregator that enforces rules like "at most one `@@textIndex` per collection" lives, since it sits above individual attribute specs.

---

## References

- [ADR 225 — Three-layer extensibility for pack-contributed entity kinds](ADR%20225%20-%20Three-layer%20extensibility%20for%20pack-contributed%20entity%20kinds.md) — the contribution model this design follows: a framework-defined extension point that families and targets register into, dispatched structurally so the framework learns no per-kind names. Attribute specs are registered the same way entity kinds are.
- [ADR 224 — Control policy: a framework-locked vocabulary with family-owned dispatch](ADR%20224%20-%20Control%20Policy%20—%20framework-locked%20vocabulary%20and%20family-owned%20dispatch.md) — the `@@control(<policy>)` attribute whose value set this design types as `oneOf(identifier('managed'), identifier('tolerated'), identifier('external'), identifier('observed'))`, and the framework-vocabulary / family-dispatch split this design mirrors, here as a PSL-layer kit with family-owned specs.
- [ADR 221 — Contract IR: two planes with a uniform entity coordinate](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md) — the coordinate model attribute resolution writes into.
- [ADR 126 — PSL top-level block SPI](ADR%20126%20-%20PSL%20top-level%20block%20SPI.md) — the descriptor SPI for generic blocks, whose `key = value` parameters are the subject of an open question above.
- [Pattern: Frozen-class AST + visitor](../patterns/frozen-class-ast.md) — the dispatch pattern for the `ArgType` combinator union across parse, print, and completion sites.
- [Pattern: Three-layer polymorphic IR](../patterns/three-layer-polymorphic-ir.md) — the framework-vocabulary → family-dispatch layering instantiated by the framework kit and family-owned specs.
