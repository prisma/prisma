# Factory-defined codec types (Mode C)

## Status

**Goal-level spec.** Describes the design target only — the *what* and *why*. Implementation approaches (functional `defineCodec`-style, abstract-class-based, or other) are deliberately out of scope; each is its own follow-up spec + spike.

This spec is written during the [TML-2357](https://linear.app/prisma-company/issue/TML-2357) `codec-registration-completion` project but represents a **substantive design pivot** that supersedes part of [ADR 208](../../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md). Adoption requires either re-scoping the parent project around this goal or splitting it into a dedicated project; that scoping decision is itself out of scope here.

## Decision

The `CodecDescriptor`'s factory function is the **single type-level source of truth** for the codec instance's output type. The factory's input-parameters type, applied at the type level, determines the resulting `Codec` instance's type parameters (`Id`, `TTraits`, `TWire`, `TInput`, etc.).

A codec is one artifact with two roles bundled together by its factory:
- **Runtime role**: `factory(params)(ctx)` materializes the runtime `Codec` instance.
- **Type-level role**: applying the factory's *type* with column-specific params yields the codec's TypeScript type at consumer sites.

Both roles are projections of the same function. The factory is not declarative metadata coordinated with separate type-level rendering machinery — it *is* the type-level rendering machinery.

Consumers that need a codec's type for a specific column (no-emit `FieldOutputType`, `sql-builder`'s parameter-typing, the ORM's row-shape derivation) read it from **the column spec on the contract**, which the column helper populated at authoring time via descriptor-factory application. The descriptor itself is never queried by these consumers; the column spec carries the typed codec (or enough information to project it) from authoring time onward.

Codec authors maintain exactly one type-level surface: the descriptor's factory function (or its class-based equivalent). No parallel `OutputType` HKT field. No hand-written codec-id-keyed type rows. No column-helper `type` slot maintained alongside the factory. The framework's emitted `contract.d.ts` carries codec type rows because emit serializes the type-level result into a static artifact — but those rows are *generated* from the descriptors, not maintained in parallel.

## Data flow

The architecture has one source artifact (the descriptor's factory) and four lifecycle phases that consult it. Every phase consults it at most once; nothing is computed twice or maintained in parallel.

```
codec author site         descriptor.factory(params) → (ctx) → Codec<...>
                             ↓ one type-level surface
                             ↓
column author site        column(descriptor, params)
                             │ helper applies descriptor.factory at the type level
                             │ helper stores typed result on the column spec
                             ↓
contract definition       contract carries column specs with their typed codecs
                             │ flows through the rest of the type system
                             ↓
no-emit consumers         FieldOutputType / sql-builder / ORM read the typed
                          codec from the column spec; descriptor not consulted

emit                      emitter walks descriptors at emit time, evaluates the
                          factory at the type level, serializes into contract.d.ts
                          (verified byte-equivalent to the no-emit type per AC-6)

runtime                   descriptorFor(codecId): AnyCodecDescriptor (type-erased)
                          materialization via descriptor.factory(params)(ctx)
```

Three patterns fall out of this flow:

1. **Source-of-truth singularity.** The descriptor's factory is the *only* artifact a codec author writes that carries type information. `paramsSchema` and `renderOutputType` are runtime artifacts (validators, string renderers); they don't carry codec types. Column helpers don't hand-roll typed returns; they delegate to the descriptor's factory at the type level.

2. **Two-layer storage separation.** The descriptor is stored twice with different access shapes:
   - **At the runtime layer**, the framework's heterogeneous registry indexes by `codecId: string` and returns `AnyCodecDescriptor` (variance-erased, correctly so — the runtime needs no types).
   - **At the type-level layer**, the column spec on the contract is the only access path. It was populated at column-author time by applying the descriptor's factory at the type level; consumers read from there.

   These two paths never cross. Type-level consumers don't query the runtime registry; runtime consumers don't query the contract type.

3. **Emit as serialization, not as parallel.** The emitter walks descriptors, evaluates the factory at the type level (within the type-checker), and serializes the result into `contract.d.ts`. This is descriptor-derived; AC-6 verifies byte-equivalence with the no-emit type to pin the agreement.

The implementation question of *what* the column spec carries — a resolved codec instance, an unapplied factory thunk, a phantom-type marker, or another shape — is deliberately left to the per-approach implementation specs. The AC-5 verification points pin the type-level outcome regardless of representation.

## Why

ADR 208 diagnosed the problem correctly (line 145):

> Both problems share a root cause: the type-level facts about a parameterized column lived in three places (the column-helper factory, the codec record, the renderer) with no single source of truth.

ADR 208's prescribed cure was column-helper-first: the column helper (`vector(N)`, `arktypeJson(schema)`) carries the typed factory; the descriptor is auxiliary. Three reasons that cure isn't right:

1. **It picks the wrong actor as the source of truth.** The column helper is a per-codec construction site for column descriptors. The codec is what actually owns the type-level transformation from inputs to outputs. Making the column helper authoritative pushes the codec's own type-level information to a layer above the codec — every parameterized codec must hand-roll a column helper that mirrors the runtime factory's types, and the two must be kept in sync. The codec descriptor's factory becomes an under-typed twin of the column helper.

2. **It doesn't actually unify; it just relocates the multiplicity.** ADR 208 still ships separate `paramsSchema`, `renderOutputType`, and (in arktype-json's case) the column descriptor's `type` slot. The user-facing API is one function call, but the internal architecture remains: column helper + codec descriptor + renderer + Standard Schema validator + (sometimes) the column `type` slot. Five artifacts that must agree per parameterized codec.

3. **It wasn't fully wired up.** At HEAD, `FieldOutputType` reads from `CodecTypesFromDefinition[codecId]['output']` — a static codec-id-keyed lookup, indexed by codec id, not by params. `vector(1536)` resolves to `number[]`, not `Vector<1536>`. The `type` slot mechanism described in ADR 208 § 2 exists only on `arktypeJson` and has no consumer. The unification is documented, not implemented.

This spec relocates the source of truth to where the codec actually owns it: **the codec descriptor's factory function**. Column helpers become derivatives — and likely collapsable into a single generic helper parameterised by the descriptor.

## Cases that pin the design

A correct implementation of this spec must accommodate every case below. Each case anchors specific acceptance criteria.

### Case 1 — Non-parameterized codec (degenerate case)

`pgInt4Descriptor` is non-parameterized: its factory takes `void`, its codec instance type is fixed at `Codec<'pg/int4@1', readonly ['equality','order','numeric'], number, number>`.

Applying the factory's type (`factory(undefined)`) at the type level produces the fixed codec instance type. This case must continue to work without ceremony — the degenerate case is the common case.

### Case 2 — Parameterized codec with literal preservation

`pgVectorDescriptor`'s factory is `<N extends number>(params: { length: N }) => (ctx) => Codec<'pg/vector@1', readonly ['equality'], string, Vector<N>>` (or equivalent expressed through the chosen implementation approach).

Applying with `params: { length: 1536 }` (literal) yields `Codec<..., Vector<1536>>` (literal preserved). Applying with `params: { length: number }` (widened) yields `Codec<..., Vector<number>>` (acceptable widened form).

This is the case that fails today: `vector(1536)` resolves to `number[]`, not `Vector<1536>`.

### Case 3 — Parameterized codec with arktype schema

`arktypeJsonDescriptor`'s factory is `<S extends Type<unknown>>(params: { schema: S }) => (ctx) => Codec<'arktype/json@1', readonly ['equality'], string, S['infer']>`.

Applying with a specific schema yields a codec typed by that schema's inferred output. This is the load case for *non-numeric* literal preservation — the typed shape is a derived TypeScript type rather than a literal value.

### Case 4 — Heterogeneous descriptor storage (runtime-only; type-erased)

The framework stores all registered descriptors in a runtime registry keyed by codec id (`descriptorFor(codecId): AnyCodecDescriptor`, `forColumn(table, column): Codec` per ADR 208). The registry's role is runtime materialization: encode/decode dispatch, contract-load-time codec instantiation, validation. **It needs no type information at all.** Consumers querying the registry receive variance-erased `AnyCodecDescriptor` and that is correct: the registry is a `Record<string, ...>` indexed by codec id, and TypeScript variance correctly erases the per-descriptor factory generics at this boundary.

Type-level access does not flow through the registry. It flows through the **column spec on the contract**, populated by column helpers at column-author time via descriptor-factory application. There is no `Descriptors<typeof contract>` projection, no per-pack typed map consulted at the type level, and no direct-reference-to-descriptor pattern in framework code (direct references are fine in tests; framework code cannot reach into specific codec implementations).

The implementation accommodates this two-layer separation: heterogeneous, type-erased registry at the runtime layer; column-spec-on-contract carrying typed codec information at the type-level layer.

### Case 5 — `FieldOutputType` derivation (column-spec-driven)

For a column declared as `column(pgVectorDescriptor, { length: 1536 })` (or via a thin per-codec wrapper like `vector(1536)` that delegates to `column`), the column helper applies the descriptor's factory at the type level with the column's params and stores the result on the column spec. The no-emit `FieldOutputType` resolver reads the typed codec from the column spec and projects its `TInput` (or equivalently, the resolved codec's `decode` return type).

There is no descriptor lookup at the resolver site; the column has what it needs. This replaces the static `CodecTypesFromDefinition[codecId]['output']` lookup HEAD uses today.

### Case 6 — Column helper collapse

A column helper today (e.g. `vector(N)`, `arktypeJson(schema)`) ships per-codec, with a hand-rolled typed return. Under this spec, a generic helper exists that works for any descriptor:

```typescript
function column<D extends AnyCodecDescriptor, P extends DescriptorParams<D>>(
  descriptor: D,
  params: P,
): ColumnTypeDescriptor & { readonly codecId: D['codecId']; readonly typeParams: P }
```

— or the equivalent expressed through the chosen implementation approach. Per-codec column helpers become trivial wrappers (`vector = (length) => column(pgVectorDescriptor, { length })`) and may be eliminable entirely.

### Case 7 — Emit-path rendering

The framework emitter walks each column and renders its TypeScript type into `contract.d.ts`. At emit time, TS-type-level resolution is not available — the emitter operates on contract IR data. The descriptor must therefore expose a runtime-callable rendering function (today's `renderOutputType: (params) => string`). Under this spec, the emit-path renderer is **the single legitimate type-level/runtime parallel** in the design — and it remains as a separate slot on the descriptor because the emit pass cannot inspect TS types at runtime.

The acceptance criterion is that this renderer's output **agrees with the no-emit type** at every column. Tests pin this agreement (the contract.d.ts emitted for `vector(1536)` is `Vector<1536>`; the no-emit `FieldOutputType` for the same column is also `Vector<1536>`).

### Case 8 — Validators (`paramsSchema`, JSON-schema validation)

The descriptor's `paramsSchema` validates the params at the JSON boundary (contract-load time) — runtime concern, no type-level role beyond constraining the factory's input type. JSON-schema validation per ADR 208 lives inside the resolved codec's `decode` body. Both stay where ADR 208 placed them.

## Acceptance criteria

A correct implementation satisfies every AC below. Implementation-approach-specific ACs (e.g. "the abstract class is named `CodecDescriptor`") belong in the per-approach spike spec, not here.

### AC-1. Factory's typed shape preserved

The `CodecDescriptor`'s factory function (or equivalent in the chosen implementation) preserves its full TypeScript signature: input-parameter types, output-codec types, and any per-codec generic parameters (e.g. `<N extends number>` for `vector`). The mechanism that constructs descriptors (`defineCodec`, an abstract base class, or other) does not strip generics from the factory's declared signature.

**Verification.** Constructive type test: a parameterized descriptor's `descriptor.factory<{ length: 1536 }>` resolves at the type level to a function returning `Codec<..., Vector<1536>>`.

### AC-2. No parallel hand-maintained type mechanism

Codec authors write exactly one type-level surface per codec: the descriptor's factory function (or its class-based equivalent). No parallel `OutputType` HKT field, no hand-written codec-id-keyed type rows alongside the descriptor, no column-helper `type` slot operating outside this flow.

Type derivations needed by the framework compute *from* the descriptor's factory:
- **No-emit path**: column helpers apply the factory at the type level at column-author time; the result lives on the column spec; consumers read it from there.
- **Emit path**: the emitter walks descriptors at emit time, evaluates the factory at the type level, and serializes the result into `contract.d.ts`'s codec type rows (today's `CodecTypes` / `TypeMaps`). The emitted rows are not a parallel surface — they are the descriptor-derived serialization. AC-6 covers byte-equivalence with the no-emit type.

**Verification.** Audit: every parameterized codec author writes one type-level artifact (the factory). Removing the source-level `CodecTypesFromDefinition` (or successor) does not break the no-emit type derivation — that path runs through column specs.

### AC-3. Literal preservation in the no-emit path

`vector(1536)`'s declared column resolves to `Vector<1536>` at the type level (literal preserved). `arktypeJson(productSchema)`'s declared column resolves to the schema's inferred output. Tests cover both cases.

**Verification.** `*.test-d.ts` constructive tests on `examples/prisma-8-demo` or an equivalent no-emit fixture. Both positive (correct types compile) and negative (wrong types fail) cases.

### AC-4. Column helpers are derivatives or eliminated

Per-codec column helpers (`vector(N)`, `arktypeJson(schema)`, `charColumn(N)`, …) either:
- Collapse into a single generic `column(descriptor, params)` helper, or
- Persist as thin wrappers that call the generic helper, contributing no type-level information beyond what the descriptor already provides.

The codec descriptor's authoring site is the only place where per-codec type-level facts are encoded.

**Verification.** No production column helper declares its return type via hand-rolled typed factory return. All column helpers are either trivial calls into a generic helper or eliminated entirely.

### AC-5. Type-level access via column spec, not via descriptor map

The type-level entry point for a codec's type is the **column spec on the contract**. The column helper, at column-author time, applies the descriptor's factory at the type level with the column's params and stores the result on the column spec. Consumers (no-emit `FieldOutputType`, sql-builder parameter typing, ORM row derivation) read the typed codec from the column spec; they do not consult any descriptor map at the type level.

Runtime descriptor storage remains heterogeneous (registered through the unified `codecs:` slot, indexed by `codecId: string`, returns `AnyCodecDescriptor`). The runtime path is variance-erased and consumes the descriptor for materialization (`descriptor.factory(params)(ctx)`); no type information is required at the runtime layer.

There is no `Descriptors<typeof contract>` projection, no per-pack typed map consulted at the type level, and no direct-reference-to-descriptor pattern in framework code. The column spec is the only type-level path; it carries everything consumers need.

**Verification.** Constructive type tests:
- At the column-author site: `column(pgVectorDescriptor, { length: 1536 })`'s return type carries the typed codec instance (or equivalent typed surface — a factory thunk whose return type resolves to the typed codec also satisfies the AC).
- At the contract-type level: walking from `typeof contract` through `models[name].fields[name]` to the column spec recovers the typed codec for that field.
- At the consumer level: `FieldOutputType<typeof contract, 'Document', 'embedding'>` resolves to `Vector<1536>` for a column declared as `column(pgVectorDescriptor, { length: 1536 })`.

### AC-6. Emit-path renderer agrees with no-emit type

For every parameterized codec and every distinct param shape, the emitted `contract.d.ts` type and the no-emit `FieldOutputType` type are byte-equivalent (after canonicalization). The descriptor's emit-path renderer remains as the only descriptor slot that runtime-renders strings; its output is verified to agree with the type-level derivation.

**Verification.** A test fixture with `vector(1536)`, `arktypeJson(productSchema)`, and a non-parameterized column. Assert that `contract.d.ts`'s emitted type for each column is byte-equivalent to the no-emit `FieldOutputType` for the same column.

### AC-7. Validation gates green

- `pnpm typecheck`, `pnpm lint:deps`, `pnpm fixtures:check`, `pnpm test:packages`, `pnpm test:e2e`, `pnpm build` all green at every commit boundary.
- No new type casts in production code. No `any`. No `@ts-expect-error` outside negative type tests. No `@ts-nocheck`. No biome suppressions.
- Demo emit byte-identical against the post-implementation baseline.

## Non-goals

- **Implementation approach.** Whether the descriptor is a function-returned object (today's `defineCodec`), an abstract base class (the next spike), a frozen interface with constructor pattern, or another shape — out of scope for this spec. Each approach gets its own spike spec under `projects/codec-registration-completion/specs/`.

- **Mode A retrofit.** Wiring up the column-`type`-slot mechanism per ADR 208's intent. This spec supersedes that direction.

- **`renderOutputType` removal / TS-compiler-API emit.** Eliminating the descriptor's emit-path renderer (e.g. by using TypeScript's compiler API to generate `contract.d.ts` from descriptor types) is not in scope. The renderer stays as one acknowledged runtime-side artifact; codec authors writing it is overhead, not damage. AC-6's byte-equivalence verification covers the practical risk.

- **Codec reuse via descriptor inheritance / aliasing / sharing across targets.** Codecs are thin and re-declared at each authoring site. Shared logic lives in utility functions (`encodeVectorWire(value)`, `decodeVectorWire(wire)`); shared *descriptors* are pointless. The class-based implementation approach (next spike) may use class inheritance internally as an organizational pattern, but this is not load-bearing for the design — every codec id has exactly one descriptor declared at one site.

- **`aliasDescriptor` as a first-class abstraction.** If kept at all, the implementation is a trivial runtime spread + `codecId` rewrite (or, under a class-based approach, a class-inheritance pattern that proxies `codecId` through a descriptor reference on the codec instance). Either way, aliasing is not a load-bearing case for this spec; deletion is acceptable.

- **`paramsSchema` relocation or removal.** Stays on the descriptor as the runtime params validator (also consumed by PSL for incoming codec parameter validation per ADR 208). Its role is unchanged under this spec.

- **Renaming.** Whether `CodecDescriptor` becomes `Codec`, `defineCodec` becomes `defineCodecDescriptor`, etc. — orthogonal naming concerns, decided per implementation approach.

- **Mongo type flow.** Mongo's wire-dispatch path is reshaped under [TML-2324](https://linear.app/prisma-company/issue/TML-2324). This spec applies to the SQL family at minimum; Mongo alignment is a separate concern.

- **Migration sequencing.** Whether this lands as a single squashed PR, a milestone sequence in the existing `codec-registration-completion` project, or a new project entirely — scoping decision, made when an implementation approach is selected.

## Implementation approaches under consideration

(Documenting briefly here for orientation; each approach gets its own follow-up spec.)

### Approach 1 — Functional with full factory-generic preservation

Today's `defineCodec(spec)` keeps its functional shape but its declared return preserves the factory's full generic signature. Consumers extract via structural inference: `D extends { factory: (...) => (...) => infer C } ? C : never`. Heterogeneous storage stays in `Record<string, AnyCodecDescriptor>` at the runtime layer; type-level consumers access via typed maps.

Pros: minimal authoring-site change for codec authors. Maps onto the existing codec ecosystem with the smallest reshape. Cons: TS variance challenges at the storage layer; structural inference patterns are verbose; the M2 R4 attempt already failed at this approach's variance boundary (see `wip/unattended-decisions.md` Decision #11).

### Approach 2 — Abstract-class-based (the user's preferred experiment)

`CodecDescriptor` is an abstract base class. Codec authors extend it and override `id`, `traits`, `targetTypes`, `paramsSchema`, `renderOutputType`, and `factory()`. The factory's return is a `Codec` instance — itself an abstract base class authors extend per codec. The class hierarchy expresses parameterization through TypeScript's natural class generics (`abstract class CodecDescriptor<TParams, TCodec extends Codec<...>>`), which TS variance handles more cleanly than function-return inference.

Pros: TypeScript's class-generic mechanics align well with the parameterization story; the relationship between descriptor and instance is explicit in the type system; column-helper collapse is mechanical (a generic helper accepts a descriptor class and instantiates per params). Cons: invasive reshape of every codec contributor; class-based authoring may feel heavier than functional; integration with existing functional patterns (Standard Schema, contributor protocol) requires care.

### Approach 3 — Other

Open. Examples: branded types + factory-applied projection types; generic descriptor types that defer instantiation until column-binding; or hybrids of approaches 1 and 2.

The class-based approach (Approach 2) is the next planned spike.

## Relationship to in-flight work

- **Parent project [`codec-registration-completion`](../spec.md).** Currently scoped to typed-flow fix (M0 per [`typed-codec-flow.spec.md`](typed-codec-flow.spec.md)) plus runtime/registration migrations (M1–M4). This spec is a generalization that subsumes M0 and re-scopes M1–M4. Adoption requires either re-scoping the project around this spec or splitting into a new project. Decision deferred to post-spike.

- **[ADR 208](../../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md).** Decision § paragraph picking the column helper as the type-level surface is partially superseded; the ADR 208 alternatives-considered HKT rejection (line 175) survives but is supplemented by this spec's factory-generic-preservation approach (a third option not weighed in ADR 208).

- **[TML-2229](https://linear.app/prisma-company/issue/TML-2229).** The codec-registry-unification project that introduced `CodecDescriptor`. The unification is preserved; the type-level layering is restructured.

- **[TML-2393](https://linear.app/prisma-company/issue/TML-2393).** The `byScalar` antipattern cleanup ticket. Absorbed into the parent project's M0 forcing-function deletion. Likely still applies in spirit under this spec — `byScalar`'s codec-instance map is exactly the kind of parallel structure this spec eliminates.

- **[TML-2324](https://linear.app/prisma-company/issue/TML-2324).** Mongo cross-family work. Out of scope for this spec.

## References

- [ADR 208 — Higher-order codecs for parameterized types](../../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md). The ADR this spec partially supersedes.
- [ADR 206 — Operations as TypeScript functions](../../../docs/architecture%20docs/adrs/ADR%20206%20-%20Operations%20as%20TypeScript%20functions.md). The "function is the signature" precedent. This spec applies the principle at the codec-descriptor layer; ADR 208 applied it at the column-helper layer.
- [ADR 184 — Codec-owned value serialization](../../../docs/architecture%20docs/adrs/ADR%20184%20-%20Codec-owned%20value%20serialization.md). The pattern of codecs owning their representations; this spec extends it to "codecs own their type-level representation too."
- [Parent spec `spec.md`](../spec.md) — `codec-registration-completion` canonical spec.
- [`typed-codec-flow.spec.md`](typed-codec-flow.spec.md) — M0 spec under the parent project; subsumed by this goal.
- [`wip/unattended-decisions.md` Decision #11](../../../wip/unattended-decisions.md) — the variance failure that exposed the multiple-actors complexity this spec addresses.
- `wip/m0-shape-spike.md` — Shape A vs Shape B spike under the parent project's M0 (Mode B); informs the type-level variance considerations relevant to Approach 1 here.
