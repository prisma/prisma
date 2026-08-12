# Class-based codec design (Mode C, Approach 2)

## Status

**Implementation-approach spec** for the [Mode C goal](factory-defined-codec-types.spec.md). Describes a specific implementation pattern where `CodecDescriptor` and `Codec` are abstract base classes that codec authors extend, and the type-flow surface is a per-codec helper function tied to its descriptor by `satisfies`.

This spec describes the **target design** of the spike. The spike itself is exploratory — small scratch-branch reshape of pgvector + a representative postgres codec, demonstrating AC-1 through AC-6 from the goal spec without touching the rest of the codebase. Scope is in [Spike scope](#spike-scope) below.

> **Empirical foundation.** An earlier draft of this spec proposed a polymorphic `column<P, R>(descriptor, params)` helper using structural matching (`{ factory(params: P): R }`) to preserve method-level generics. A TypeScript playground proof falsified that approach: TS instantiates method generics to their constraint at every form of structural extraction (structural match, indexed access, `Parameters`/`ReturnType`, etc.). The current design avoids that path entirely. See [`wip/m0-class-variance-proof.md`](../../../wip/m0-class-variance-proof.md) for the proof and the rejected alternatives.

## Decision

A codec is **two paired classes plus one per-codec column helper function**, tied together by `satisfies`:

- **`CodecDescriptor`** — abstract base class. Codec authors extend it to declare a codec's identity (`codecId`, `traits`, `targetTypes`), validate its parameters (`paramsSchema`), produce its codec instance from params (`factory()`), and render its TS output type for the emit path (`renderOutputType()`).
- **`Codec`** — abstract base class. Codec authors extend it to implement `encode`/`decode` (and JSON variants where applicable). The instance retains a reference to its descriptor; metadata reads (`id`, `traits`) proxy through the descriptor for one source of truth.
- **Per-codec column helper** — a hand-written function (e.g. `vector(length)`, `arktypeJson(schema)`) generic over the same shape as its descriptor's `factory`. The helper invokes `descriptor.factory(...)` **directly** (not via structural extraction). The direct invocation is what preserves method-level generics — TS binds `<N>` to the literal at the call site because the call is a direct method call, not a function-type extraction. A `satisfies ColumnHelperFor<D>` clause ties the helper to its descriptor at compile time, catching wiring mistakes (wrong `codecId`, wrong factory wired in, mismatched typeParams shape).

The framework provides a trivial `column()` packager that constructs the column-spec record from `(codec, codecId, typeParams)`. It is **not** generic over descriptors — that path was the variance trap. Per-codec helpers absorb the descriptor relationship instead, with `satisfies` enforcing it.

This is the implementation pattern the goal spec ([`factory-defined-codec-types.spec.md`](factory-defined-codec-types.spec.md)) calls for — factory-as-source-of-truth, expressed through the class hierarchy plus per-codec helpers.

## Class hierarchy

### `CodecDescriptor`

Lives in `@internal/framework-components/codec` (replacing today's `CodecDescriptor` interface).

```typescript
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { CodecInstanceContext } from './codec-instance-context';
import { Codec } from './codec';

export abstract class CodecDescriptor<TParams = void> {
  abstract readonly codecId: string;
  abstract readonly traits: readonly CodecTrait[];
  abstract readonly targetTypes: readonly string[];
  readonly meta?: CodecMeta;

  /**
   * Standard Schema validator for the descriptor's params. Validates the
   * params shape at the JSON boundary (contract-load time, PSL parsing).
   * The factory's typed input is the type-level constraint; this schema
   * is its runtime counterpart.
   */
  abstract readonly paramsSchema: StandardSchemaV1<TParams>;

  /**
   * Render the TypeScript output type as a source string for the emit
   * path. Optional; non-parameterized codecs and codecs whose output
   * type is fixed (e.g. `number`, `string`) return undefined and the
   * emitter falls through to the codec's base output type.
   */
  renderOutputType?(params: TParams): string | undefined;

  /**
   * Materialize a runtime codec instance for the given params. The
   * factory's TS-level typed return determines the codec instance type
   * for type-level consumers — but only at *direct* call sites
   * (per-codec helpers, framework runtime). It does NOT survive
   * structural extraction; that's why the column-helper surface is
   * per-codec, not polymorphic.
   *
   * Concrete subclasses override this method with a typed return type
   * (e.g. `factory<N>(params: { length: N }): (ctx) => VectorCodec<N>`).
   * Direct callers (per-codec helpers) read the typed return; the
   * runtime registry sees only the abstract base's signature.
   */
  abstract factory(params: TParams): (ctx: CodecInstanceContext) => Codec<string, readonly CodecTrait[], unknown, unknown>;
}
```

### `Codec`

Lives in `@internal/framework-components/codec` (replacing today's `Codec` interface).

```typescript
import type { CodecDescriptor } from './codec-descriptor';

export abstract class Codec<
  Id extends string,
  TTraits extends readonly CodecTrait[],
  TWire,
  TInput,
> {
  constructor(public readonly descriptor: CodecDescriptor<unknown>) {}

  /** Codec id, proxied from the descriptor. One source of truth. */
  get id(): Id {
    return this.descriptor.codecId as Id;
  }

  /** Codec traits, proxied from the descriptor. */
  get traits(): TTraits {
    return this.descriptor.traits as TTraits;
  }

  abstract encode(value: TInput, ctx: SqlCodecCallContext): Promise<TWire>;
  abstract decode(wire: TWire, ctx: SqlCodecCallContext): Promise<TInput>;

  encodeJson?(value: TInput): JsonValue;
  decodeJson?(json: JsonValue): TInput;
}
```

The codec instance retaining a reference to its descriptor solves the aliasing concern raised during goal-spec discussion: aliased codecs (if kept at all) point their codec instances at the alias descriptor, and `codec.id` reads the alias's `codecId`. No instance-level `id` field to keep in sync.

### Concrete codec author pattern

Authoring a codec is **three artifacts**: the descriptor class, the codec instance class, and the per-codec column helper function. Three illustrative examples spanning the case spectrum.

#### Non-parameterized codec (Case 1)

```typescript
class PgInt4Codec extends Codec<'pg/int4@1', readonly ['equality', 'order', 'numeric'], number, number> {
  async encode(value: number): Promise<number> {
    return value;
  }
  async decode(wire: number): Promise<number> {
    return wire;
  }
}

class PgInt4Descriptor extends CodecDescriptor<void> {
  readonly codecId = 'pg/int4@1' as const;
  readonly traits = ['equality', 'order', 'numeric'] as const;
  readonly targetTypes = ['int4'];
  readonly paramsSchema = voidParamsSchema;

  factory(): (ctx: CodecInstanceContext) => PgInt4Codec {
    return (ctx) => new PgInt4Codec(this);
  }
}

export const pgInt4Descriptor = new PgInt4Descriptor();

export const int4 = () => column(
  pgInt4Descriptor.factory(),
  pgInt4Descriptor.codecId,
  undefined,
);
int4 satisfies ColumnHelperFor<PgInt4Descriptor>;
```

The factory has no method-level generic — non-parameterized codecs return the same `PgInt4Codec` for every call. The `int4()` helper is a thin wrapper packaging the codec factory + metadata into a column spec.

#### Parameterized codec with literal preservation (Case 2)

```typescript
class VectorCodec<N extends number> extends Codec<'pg/vector@1', readonly ['equality'], string, Vector<N>> {
  constructor(descriptor: CodecDescriptor<{ readonly length: N }>, public readonly dimension: N) {
    super(descriptor);
  }
  async encode(value: Vector<N>): Promise<string> {
    return `[${value.join(',')}]`;
  }
  async decode(wire: string): Promise<Vector<N>> {
    return parsed as Vector<N>;
  }
}

class PgVectorDescriptor extends CodecDescriptor<{ readonly length: number }> {
  readonly codecId = 'pg/vector@1' as const;
  readonly traits = ['equality'] as const;
  readonly targetTypes = ['vector'];
  readonly paramsSchema = vectorParamsSchema;

  factory<N extends number>(
    params: { readonly length: N },
  ): (ctx: CodecInstanceContext) => VectorCodec<N> {
    return (ctx) => new VectorCodec<N>(this, params.length);
  }

  renderOutputType(params: { readonly length: number }): string {
    return `Vector<${params.length}>`;
  }
}

export const pgVectorDescriptor = new PgVectorDescriptor();

export const vector = <N extends number>(length: N) => column(
  pgVectorDescriptor.factory({ length }),
  pgVectorDescriptor.codecId,
  { length },
);
vector satisfies ColumnHelperFor<PgVectorDescriptor>;
```

The class-level params type is `{ readonly length: number }` (widest bound). The **method-level generic** `<N extends number>` on `factory` is what preserves the literal at call sites: when `vector(1536)` calls `pgVectorDescriptor.factory({ length: 1536 })` *directly*, TS binds `N=1536` from the call site. The `vector` helper's own generic `<N extends number>(length: N)` captures the literal one level further out, and the literal flows through the column spec into the contract type.

This is the core variance pattern of the class-based design: method generics on the descriptor's factory are preserved by **direct invocation inside the per-codec helper**, not by extraction at a polymorphic helper.

#### Parameterized codec with arktype schema (Case 3)

```typescript
class ArktypeJsonCodec<S extends Type<unknown>> extends Codec<
  'arktype/json@1',
  readonly ['equality'],
  string,
  S['infer']
> {
  constructor(
    descriptor: CodecDescriptor<{ readonly schema: S }>,
    private readonly schema: S,
  ) {
    super(descriptor);
  }
  async encode(value: S['infer']): Promise<string> {
    return JSON.stringify(value);
  }
  async decode(wire: string): Promise<S['infer']> {
    const raw = JSON.parse(wire);
    const result = this.schema(raw);
    if (result instanceof type.errors) {
      throw new Error(`...`);
    }
    return result;
  }
}

class ArktypeJsonDescriptor extends CodecDescriptor<{ readonly schema: Type<unknown> }> {
  readonly codecId = 'arktype/json@1' as const;
  readonly traits = ['equality'] as const;
  readonly targetTypes = ['jsonb'];
  readonly paramsSchema = arktypeJsonParamsSchema;

  factory<S extends Type<unknown>>(
    params: { readonly schema: S },
  ): (ctx: CodecInstanceContext) => ArktypeJsonCodec<S> {
    return (ctx) => new ArktypeJsonCodec<S>(this, params.schema);
  }

  renderOutputType(params: { readonly schema: { expression: string } }): string {
    return params.schema.expression;
  }
}

export const arktypeJsonDescriptor = new ArktypeJsonDescriptor();

export const arktypeJson = <S extends Type<unknown>>(schema: S) => column(
  arktypeJsonDescriptor.factory({ schema }),
  arktypeJsonDescriptor.codecId,
  { schema },
);
arktypeJson satisfies ColumnHelperFor<ArktypeJsonDescriptor>;
```

Same pattern as `vector`: method-level generic on the descriptor's factory; the per-codec helper's own generic captures the schema's specific type and threads it through the direct call.

## Column type-flow surface

The framework exposes one trivial `column()` packager. Per-codec helpers compose with it.

### Framework `column()` packager

Lives in `@internal/framework-components/codec` (or alongside `ColumnTypeDescriptor`).

```typescript
type ColumnSpec<R, P> = ColumnTypeDescriptor & {
  readonly codecFactory: (ctx: CodecInstanceContext) => R;
  readonly codecId: string;
  readonly typeParams: P;
};

export function column<R, P>(
  codecFactory: (ctx: CodecInstanceContext) => R,
  codecId: string,
  typeParams: P,
): ColumnSpec<R, P> {
  return { codecFactory, codecId, typeParams /* + ColumnTypeDescriptor fields */ };
}
```

Generic over `R` (the codec instance type) and `P` (the typeParams object). The framework does **not** try to infer `R` and `P` from a descriptor — that's the per-codec helper's job. This is intentional: the polymorphic version was the variance trap.

### Per-codec helper pattern

Each codec ships its own column helper. The helper:
1. Is generic over the same shape as its descriptor's `factory` method generic.
2. Calls `descriptor.factory({...})` **directly** — not via structural extraction.
3. Packages the result with `column(codecFactory, codecId, typeParams)`.
4. Asserts conformance with `satisfies ColumnHelperFor<D>`.

```typescript
export const vector = <N extends number>(length: N) => column(
  pgVectorDescriptor.factory({ length }),
  pgVectorDescriptor.codecId,
  { length },
);
vector satisfies ColumnHelperFor<PgVectorDescriptor>;
```

Direct invocation `pgVectorDescriptor.factory({ length })` is the load-bearing piece. TypeScript binds `<N>` to the literal from the call site at this point — the same way `vectorDescriptor.factory({ length: 1536 })` binds `N=1536` in any direct method call. The literal flows through `column(...)`'s `R` and `P` generics into the column spec.

### `satisfies ColumnHelperFor<D>` discipline

The framework exports two `ColumnHelperFor` shapes; codec authors pick the one appropriate to their helper.

#### Coarse — checks typeParams shape only

```typescript
export type ColumnHelperFor<D extends CodecDescriptor<any>> = (
  ...args: any[]
) => ColumnSpec<unknown, Parameters<D['factory']>[0]>;
```

Catches:
- Wrong typeParams shape (e.g. helper packaging `{ wrongKey: ... }` when descriptor's factory takes `{ length: ... }`).

Does **not** catch:
- Wrong codec instance type (the helper could wire in a different descriptor's factory and pass the coarse check).

Use when the codec doesn't have a stable `ReturnType<factory>` that's worth checking (e.g. heavily overloaded factories).

#### Strict — also checks codec base type

```typescript
export type ColumnHelperForStrict<D extends CodecDescriptor<any>> = (
  ...args: any[]
) => ColumnSpec<ReturnType<D['factory']>, Parameters<D['factory']>[0]>;
```

Catches:
- Coarse case + wrong codec instance type (e.g. helper invoking `arktypeJsonDescriptor.factory(...)` while declaring as `ColumnHelperForStrict<PgVectorDescriptor>`).

Does **not** catch:
- Literal-level mismatches between helper's promised codec type and descriptor's factory's typed return. This is fine — `ReturnType<D['factory']>` widens method generics to their constraint; the satisfies check is for sanity, and literal preservation comes from the direct invocation, not the satisfies clause.

Use as the default. The widened `ReturnType` is sufficient because it catches the most common wiring mistake (wrong descriptor) without false positives on literal preservation.

### Type extraction at consumer sites

Consumers of a column spec project the codec type via simple type-level extraction:

```typescript
const embeddingColumn = vector(1536);
//    ^? ColumnSpec<VectorCodec<1536>, { length: 1536 }>

type ResolvedCodec<C> = C extends ColumnSpec<infer R, any> ? R : never;
type EmbeddingCodec = ResolvedCodec<typeof embeddingColumn>;
//   ^? VectorCodec<1536>
```

Because the literal was bound at the per-codec helper's call site (not extracted from the descriptor), `R` flows through `column(...)`'s `R` generic carrying the literal. `ResolvedCodec` extracts it cleanly via `infer R` — no method generic to widen.

For `FieldOutputType` (consumed by `contract.d.ts` no-emit definitions):

```typescript
type ColumnInputType<C> = ResolvedCodec<C> extends Codec<any, any, any, infer T> ? T : never;
type EmbeddingInput = ColumnInputType<typeof embeddingColumn>;
//   ^? Vector<1536>

const settingsColumn = arktypeJson(productSchema);
type SettingsInput = ColumnInputType<typeof settingsColumn>;
//   ^? typeof productSchema['infer']
```

## Heterogeneous storage at the runtime layer

The framework's descriptor registry is keyed by `codecId: string` and stores type-erased descriptor instances. Per Q-3c (spike-resolved), the canonical erasure type is `AnyCodecDescriptor` (a `CodecDescriptor<any>` alias defined in `framework-components/shared/codec-descriptor.ts` with the `biome-ignore` comment naming the variance rationale):

```typescript
import type { AnyCodecDescriptor } from '@internal/framework-components/codec';

class CodecDescriptorRegistry {
  private readonly descriptors = new Map<string, AnyCodecDescriptor>();

  register(descriptor: AnyCodecDescriptor): void {
    this.descriptors.set(descriptor.codecId, descriptor);
  }

  descriptorFor(codecId: string): AnyCodecDescriptor | undefined {
    return this.descriptors.get(codecId);
  }
}
```

`CodecDescriptor<P>` is invariant in `P` (per Q-3c: `factory` and `renderOutputType` use `P` contravariantly), so `CodecDescriptor<unknown>` is **not** assignable from concrete subclasses' `CodecDescriptor<SpecificParams>` — the `<unknown>` shape would force `as` casts at every register / retrieve boundary, violating AC-CB-5 below. `AnyCodecDescriptor` is the only erasure form that admits cast-free heterogeneous storage. Runtime consumers of the registry call `descriptor.factory(validatedParams)(ctx)` to materialize codec instances; the abstract `factory()` signature (returning `Codec<string, readonly CodecTrait[], unknown, unknown>`) is sufficient. No type information is needed at the runtime layer.

Per-codec helpers don't pass through the registry — they're imported directly by extension authors and column-defining sites. The registry exists for runtime lookup (by `codecId` string), where types are already erased.

## Why classes work for this design

The class hierarchy isn't load-bearing for variance preservation (per-codec helpers' direct calls do that work). It's load-bearing for **structure**: declaring the descriptor + codec pair with one inheritable identity, holding the descriptor reference in the codec instance, and giving aliases a natural extension shape.

Two specific reasons the class form is preferable to a record-based descriptor:

### 1. Codec instance ↔ descriptor reference is structural

The abstract `Codec` constructor takes a `descriptor: CodecDescriptor<unknown>`; concrete codec subclasses pass it via `super(descriptor)`. `codec.id` and `codec.traits` proxy through this reference. Aliases work for free: an alias descriptor produces a codec instance whose `descriptor` points to the alias, so `codec.id` reports the alias's `codecId` automatically.

The record-based equivalent requires every codec author to thread the descriptor reference through an object-literal constructor parameter. Workable, but error-prone — and identical structure has to be repeated at every codec definition site.

### 2. Subclass-based authoring is uniform across the codec spectrum

Non-parameterized, parameterized, schema-typed, alias — all four shapes are expressed as `class X extends CodecDescriptor<...>` with overrides on the abstract members. The variance behavior is identical across all four: the per-codec helper handles literal preservation via direct calls; the descriptor class declares the shape.

The record-based equivalent has subtly different mechanics for each case (records vs records-of-functions vs branded literal types vs spread-and-override aliases). Authoring overhead scales worse.

## Acceptance criteria

The goal spec's AC-1 through AC-7 apply unchanged. This implementation spec adds class-based-design-specific ACs.

### AC-CB-1. Class hierarchy declarations

- `CodecDescriptor` is an exported abstract base class from `@internal/framework-components/codec`.
- `Codec` is an exported abstract base class from the same package.
- Both replace today's interface-shaped declarations.
- Legacy interfaces (if they survive at all) are kept only as deprecated aliases for type-only consumption during the transition; deletion is acceptable per AC-7 (validation gates green).

### AC-CB-2. Per-codec helper preserves method generics through direct invocation

For each parameterized codec demonstrated in the spike:
- `descriptor.factory(specificParams)` types as `(ctx) => SpecificCodec<literalParams>` at any direct call site (verified at HEAD; this is baseline TS behavior, not novel).
- The per-codec helper (e.g. `vector(1536)`) returns a column spec whose `codecFactory` types as `(ctx) => SpecificCodec<literalParams>` with literals preserved.
- `ResolvedCodec<typeof helper(...)>` projects to `SpecificCodec<literalParams>` with literals preserved.

**Verification.** Negative type tests in `*.test-d.ts` files for at least:
- `pgVectorDescriptor.factory({ length: 1536 })` → `(ctx) => VectorCodec<1536>` (baseline confirmation).
- `vector(1536)` → `ColumnSpec<VectorCodec<1536>, { length: 1536 }>`.
- `arktypeJsonDescriptor.factory({ schema: testSchema })` → `(ctx) => ArktypeJsonCodec<typeof testSchema>` (baseline).
- `arktypeJson(testSchema)` → `ColumnSpec<ArktypeJsonCodec<typeof testSchema>, ...>`.
- Negative test: `ResolvedCodec<typeof vector(1536)>` is NOT assignable to `VectorCodec<999>`.

### AC-CB-3. Per-codec helper conforms via `satisfies`

For each per-codec helper in the spike:
- The helper has a `satisfies ColumnHelperFor<D>` (or `ColumnHelperForStrict<D>`) clause referencing its descriptor's class.
- A negative type test demonstrates that a malformed helper (wrong typeParams shape, or wrong descriptor's factory wired in for the strict form) fails to satisfy the clause — verified via `// @ts-expect-error` directive.

### AC-CB-4. Codec instance descriptor reference

- Every concrete `Codec` subclass in the spike receives a `descriptor` constructor argument and passes it to the abstract base's constructor.
- `codec.id` and `codec.traits` proxy through `this.descriptor.codecId` / `this.descriptor.traits` (no instance-level fields).
- A round-trip test confirms: `pgVectorDescriptor.factory(params)(ctx).id === pgVectorDescriptor.codecId`.

### AC-CB-5. Heterogeneous registry stores type-erased descriptors

- The registry signature uses `AnyCodecDescriptor` (the `CodecDescriptor<any>` alias defined in `framework-components/shared/codec-descriptor.ts`) per Q-3c. **Do not** use `CodecDescriptor<unknown>` — it is not assignable from concrete `CodecDescriptor<SpecificParams>` subclasses because `CodecDescriptor<P>` is invariant in `P`.
- A test demonstrates: registering concrete descriptors, retrieving by codec id, calling `descriptor.factory(params)(ctx)` to materialize codec instances. **No `as` casts at the registry's storage / retrieval boundary.** If a test uses `as CodecDescriptor<unknown>` (or any equivalent), that's a violation of this AC and a signal that `AnyCodecDescriptor` should be used instead.

### AC-CB-6. Spike scope demonstrated end-to-end

- The spike scratch branch demonstrates the full data flow for at least one parameterized codec:
  1. Codec author writes `PgVectorDescriptor`, `VectorCodec`, and `vector(N)` helper.
  2. Column author calls `vector(1536)` and gets back `ColumnSpec<VectorCodec<1536>, { length: 1536 }>`.
  3. Contract definition aggregates the column spec; `typeof contract` carries the typed codec.
  4. A no-emit consumer (test fixture mimicking `FieldOutputType`) projects the typed codec from the contract type and resolves to `Vector<1536>`.
- The spike does **not** reshape the runtime contributor protocol, the contributor-pack registration flow, or the contract-load-time materialization machinery beyond what's needed for the demo.

## Open questions to resolve in the spike

These questions don't block the spike from starting; they get answered as part of the spike's findings.

### Q-1. Class generic on `Codec` vs phantom types

The current design parameterizes `Codec<Id, TTraits, TWire, TInput>` positionally with concrete-instance-level types. An alternative: `Codec<TDescriptor extends CodecDescriptor<any>>` where `Id`, `TTraits`, `TWire`, `TInput` are derived from the descriptor type. Trade-off: tighter coupling but fewer type parameters at codec subclass declaration sites.

The spike picks one. Recommendation pending: probably the positional form (current design) for clarity; the descriptor-derived form may be useful as a convention.

### Q-2. Where do `column()` and `ColumnHelperFor<D>` live?

**Resolved by spike** ([`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md) § Q-A): **layer 1 (`framework-components`), structurally compatible with `ColumnTypeDescriptor`**.

Importing `ColumnTypeDescriptor` from `@internal/contract-authoring` (layer 2) into `framework-components` (layer 1) would violate layering and trip `pnpm lint:deps`. Resolution: inline a structural mirror (`ColumnTypeDescriptorShape`) inside `column-spec.ts` and expose a type-level sanity check (`_ColumnSpecIsColumnTypeDescriptorCompatible`) verifying `ColumnSpec<R, P>` remains assignable to `ColumnTypeDescriptor` at consumer sites without an explicit `extends`. If `column()` later moves to a layer-2+ package, this becomes a real `extends`.

### Q-3. `paramsSchema` in the abstract class — required or optional?

The current declaration has it `abstract readonly paramsSchema: StandardSchemaV1<TParams>`. For non-parameterized codecs (`TParams = void`), authors write `readonly paramsSchema = voidParamsSchema`. Acceptable; the alternative is making it optional and providing a default. The spike picks one.

### Q-3b. typeParams readonness convention

**Resolved by spike** ([`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md) § Q-B): **non-readonly typeParams literal in helpers; readonly in the descriptor's factory params type.**

The descriptor declares `factory<N>(params: { readonly length: N })`; the per-codec helper writes `column(... , { length })` (non-readonly literal). TS treats them as bidirectionally assignable in property-position matches, so the asymmetry is harmless. We do **not** force `Readonly<P>` at the `ColumnSpec<R, P>` boundary — leaving the helper's literal non-readonly keeps the consumer-facing type inspection (`embeddingColumn.typeParams.length`) from being needlessly ceremonious.

### Q-3c. `Codec` constructor argument variance

**Resolved by spike** ([`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md) § Q-C): **`CodecDescriptor<any>` (with biome-ignore) is canonical.**

`CodecDescriptor<P>` is invariant in `P` (the `factory` and `renderOutputType` slots use `P` contravariantly), so concrete subclasses do not extend `CodecDescriptor<unknown>`. The codebase's prevailing convention is to type variance-erased descriptor parameters as `CodecDescriptor<any>` with a `// biome-ignore lint/suspicious/noExplicitAny: variance erasure …` comment (matches the existing `AnyCodecDescriptor` alias in `codec-types.ts`). The class-based design follows the same convention everywhere a heterogeneous-storage or variance-erased boundary surfaces (the abstract `Codec` constructor's descriptor parameter, `ColumnHelperFor<D extends CodecDescriptor<any>>`, registry storage type, etc.). Concrete codec subclasses retain typed access through their own state (the descriptor reference is typed at the subclass's `super(descriptor)` site).

### Q-4. Does aliasing keep its first-class form?

Per the goal spec's non-goals, deletion is acceptable. If kept, the natural class-based pattern is class extension:

```typescript
class PgCharDescriptor extends SqlCharDescriptor {
  readonly codecId = 'pg/char@1' as const;
  readonly targetTypes = ['character'];
}
```

The codec instance produced by `pgCharDescriptor.factory()` returns a `SqlCharCodec` whose `descriptor` reference points to the `pgCharDescriptor` instance — `codec.id` reports `'pg/char@1'` automatically. The per-codec helper is similarly aliased: `pgChar = (length) => column(pgCharDescriptor.factory({length}), pgCharDescriptor.codecId, {length})`.

The spike includes one alias example to verify this works.

### Q-5. JSON validators registry retirement

The goal spec preserves `paramsSchema`; today there's also a `JsonSchemaValidatorRegistry` (per ADR 208's per-library JSON design). The class-based design's natural shape: validation lives inside the codec instance's `decode` body (already the case for `arktypeJson` per ADR 208). The registry retirement is tracked under TML-2357 M4 and is independent of this spike.

### Q-5b. `override` keyword discipline

**Resolved by spike** ([`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md) § Q-D): authors must write `override` on every concrete-subclass member that overrides an abstract or default member of the base class.

The workspace's `noImplicitOverride` setting requires this for `factory`, `meta`, `renderOutputType`, and any other inherited member touched in a subclass. TS catches missing-`override` mistakes, which is the point — but it's worth flagging in author docs that `override factory(...)` (not `factory(...)`) is the correct shape.

### Q-5c. Where do cross-codec / heterogeneous-registry tests live?

**Resolved by spike** ([`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md) § Q-E): **`packages/0-config/test-utils` (or a dedicated test fixture package), not the codec packages themselves.**

The spike's heterogeneous-registry test wanted access to both `pgVectorDescriptor` (extension) and `pgInt4Descriptor` (target). Pulling cross-extension devDeps into pgvector or postgres tests felt heavy; the spike worked around it by defining a tiny inline non-parameterized codec inside the pgvector test. For full M0, the registry / cross-codec integration tests should live in a fixture package that has clean access to multiple descriptors without forcing each codec package to devDep its peers.

### Q-6. Async constructors for codec instances?

Some codec instances might need async setup (e.g. an encryption codec deriving keys at materialization time). Today's `factory(params)(ctx) => Codec` returns a sync `Codec`. The class form: codec instance constructors are sync in TS; async setup would require `factory` to return `Promise<Codec>` or for the codec itself to expose an `async ready()` method.

Out of scope for the spike; the spike codecs are all sync-constructible.

## Spike scope

The spike's deliverable is a scratch branch (off the current project branch's `efc0a988c` or its successor), demonstrating the class-based design end-to-end for **one parameterized codec** plus **one non-parameterized codec** plus **per-codec helpers + `satisfies` clauses**.

### What the spike implements

In a scratch branch, no production-quality migration:

1. **`framework-components/src/shared/codec-descriptor.ts`** — new. Abstract `CodecDescriptor` class.
2. **`framework-components/src/shared/codec.ts`** — new. Abstract `Codec` class.
3. **`framework-components/src/shared/column.ts`** — new (or in another package as Q-2 decides). Trivial `column(codecFactory, codecId, typeParams)` packager. `ColumnHelperFor<D>` and `ColumnHelperForStrict<D>` shape exports.
4. **`extension-pgvector/src/core/codecs.ts`** — reshape pgvector's `PgVectorDescriptor` and `VectorCodec` into class form. Add the `vector(N)` per-codec helper with `satisfies ColumnHelperForStrict<PgVectorDescriptor>`. Keep one example of the legacy descriptor form alongside if helpful for diffing.
5. **`target-postgres/src/core/codecs.ts`** — reshape one non-parameterized codec (e.g. `pgInt4`) into class form. Add the `int4()` per-codec helper.
6. **`extension-pgvector/test/spike-class-based.types.test-d.ts`** (new) — negative type tests covering AC-CB-2 and AC-CB-3:
   - `vector(1536)` → `ColumnSpec<VectorCodec<1536>, { length: 1536 }>`
   - `ResolvedCodec<typeof vector(1536)>` → `VectorCodec<1536>` (and NOT `VectorCodec<999>`)
   - `vector satisfies ColumnHelperForStrict<PgVectorDescriptor>` ✅
   - Malformed helper variants fail `satisfies` (with `// @ts-expect-error` directives)
7. **`extension-pgvector/test/spike-class-based.test.ts`** (new) — runtime test covering AC-CB-4: codec instance's `descriptor` reference; codecId proxying; encode/decode round-trip on a sample vector.
8. **A fixture demo** under `examples/` or in tests showing the full flow for one column.

### What the spike does NOT do

- Migrate other codecs (postgres, sqlite, sql-family, mongo). These are post-spike implementation work.
- Touch the contributor protocol or the contributor-pack registration flow.
- Change `contract.d.ts` emission. The spike demonstrates the no-emit type derivation; emit-path verification is a post-spike concern.
- Update consumers (sql-builder, sql-orm-client, contract-ts). The spike only proves the class-hierarchy + per-codec helper shape works.
- Resolve TML-2393's `byScalar` cleanup. That's part of M0 of the parent project's existing scope.

### Spike deliverables

- Scratch branch `spike/class-based-codecs` (off the project branch).
- Spike report at `wip/class-based-codec-spike.md` summarizing findings, including:
  - Did AC-CB-1 through AC-CB-6 pass?
  - Did the per-codec helper + `satisfies` discipline preserve literals end-to-end as the playground proof predicted?
  - What unexpected friction surfaced?
  - What's the projected diff cost of full M0 implementation under this design (per-codec helper authoring overhead, satisfies discipline, etc.)?
  - Recommendation: proceed with class-based + per-codec-helper or fall back to functional?

The spike's report informs the next decision: whether to commit to the class-based approach for the project or refine further.

## Risks

### Per-codec helper boilerplate

Each parameterized codec ships a small per-codec helper function (~5 lines). For ~22 codecs in postgres + ~10 in sqlite + a few in extensions, that's ~40 helpers. Modest but real. Mitigation: codec authors who don't need ergonomic surface tweaks can use a single-line passthrough form; only authors needing custom surfaces (defaults, derived params, positional vs object-arg) write more.

### `satisfies` not catching literal-level mismatches

`ColumnHelperForStrict<D>` checks the helper's return is `ColumnSpec<ReturnType<D['factory']>, ...>`. `ReturnType` widens method generics, so a helper that accidentally widens its own generic (e.g. `<N extends number>(length: N)` becoming `(length: number)`) still satisfies the clause — but the column spec loses the literal. Mitigation: the `*.test-d.ts` negative tests in AC-CB-2 cover this; a helper that widens fails the literal-preservation test.

### Codec instance class proliferation

Today's codecs are object literals; the class form requires a class declaration per codec. For postgres alone, ~22 codec class declarations + ~22 descriptor class declarations + ~22 helper functions = ~66 codec-related artifacts. Not technically problematic but visually heavier than today's object-literal codecs.

Mitigation: a `defineSimpleCodec` helper that produces a concrete codec class from `{ encode, decode }` functions. Authors who don't need class-level state (the common case) write the helper-based form; only stateful codecs (e.g. arktype-json with its schema) write full class declarations.

### `super()` discipline in the codec abstract base

Codec subclasses must call `super(descriptor)` in their constructors. If an author forgets, TypeScript catches it (the abstract `Codec`'s constructor parameter is required). But it's one more thing to remember. Mitigation: `defineSimpleCodec` handles the `super()` call.

### Async / sync codec divergence

Per ADR 204, codec encode/decode are async. Codec instance construction is sync (TS class constructor limitation). For codecs that need async setup, the class form requires a `static async create()` factory pattern or an async `ready()` method. None of today's codecs need this; flagged as a future consideration.

### Performance of class instantiation per column

The current factory pattern returns a shared codec instance for non-parameterized codecs — same instance for every column. The class-based design keeps this property: `factory()(ctx) => new PgInt4Codec(this)` could be optimized to return a cached singleton:

```typescript
class PgInt4Descriptor extends CodecDescriptor<void> {
  private cachedCodec?: PgInt4Codec;
  factory(): (ctx) => PgInt4Codec {
    return (ctx) => {
      this.cachedCodec ??= new PgInt4Codec(this);
      return this.cachedCodec;
    };
  }
}
```

For parameterized codecs, the per-column instance is the design — each column gets a codec instance closing over its specific params. No regression vs. today.

## Non-goals

- **Polymorphic column helper.** Falsified by the playground proof. Out of scope.
- **Functional approach (Approach 1).** Out of scope. If the class-based spike fails, the functional fallback re-enters consideration.
- **Full codec migration across the codebase.** The spike reshapes one or two codecs only; full migration is post-spike implementation work.
- **Contributor protocol changes.** The spike doesn't touch how codecs register with the framework; it only shows that the class form satisfies the existing protocol's shape requirements.
- **`Codec.id` field elimination across the codebase.** The codec instance's `id` field becomes a getter proxying to the descriptor; consumers that today read `codec.id` continue to work without change. Whether to delete the field entirely (forcing all consumers through `codec.descriptor.codecId`) is a separate cleanup.
- **`paramsSchema`'s relationship to the factory's TS input type.** Could in principle be derived (the schema's parsed output type assignable to factory's input type); the spike treats them as separate artifacts that authors keep aligned, with a separate ticket / cleanup if mechanical derivation is desirable later.

## References

- [`factory-defined-codec-types.spec.md`](factory-defined-codec-types.spec.md). The goal spec this implementation approach satisfies.
- [`typed-codec-flow.spec.md`](typed-codec-flow.spec.md). The M0 sub-spec under the parent project; subsumed by the goal spec.
- [Parent spec `spec.md`](../spec.md). The `codec-registration-completion` canonical project spec.
- [ADR 208 — Higher-order codecs for parameterized types](../../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md). The ADR partially superseded by the goal spec.
- [`wip/m0-class-variance-proof.md`](../../../wip/m0-class-variance-proof.md). The TS playground proof that falsified the polymorphic-column-helper approach and informed the per-codec-helper design.
- [`wip/codec-class-variance-proof/`](../../../wip/codec-class-variance-proof/). The proof's supporting playground files (gitignored).
- [`wip/class-based-codec-spike.md`](../../../wip/class-based-codec-spike.md). The Pattern E spike report (six ACs validated end-to-end on the `spike/class-based-codecs` branch). Captured TS error messages from negative tests, friction items, and resolved spec questions (Q-A..E).
- [`wip/unattended-decisions.md` Decision #11](../../../wip/unattended-decisions.md). The variance failure that surfaced this design space.
- `wip/m0-shape-spike.md`. Shape A vs Shape B (functional Mode B) findings.
