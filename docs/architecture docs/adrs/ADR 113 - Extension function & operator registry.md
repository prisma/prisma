# ADR 113 — Extension function & operator registry

## Context

Target extensions like PostGIS and pgvector introduce functions (e.g., `ST_DWithin`) and operators (e.g., `<->`, `@@`) that developers need to call from the relational DSL. We must provide a way to:

- Type-check these calls and infer result types
- Render them deterministically for the active adapter profile
- Gate them on adapter capabilities and extension presence
- Keep core lane DSLs and adapters free of hardcoded feature knowledge

## Problem

- Hardcoding functions/operators in core breaks modularity and pace of innovation
- Free-form string calls ruin type safety, determinism, and preflight checks
- Dialects differ in naming, schema qualification, casting rules, and operator tokens
- Agents and CI need a structured source of truth for what a function/operator does without running database introspection

## Decision

Introduce an Extension Function & Operator Registry that packs can populate. The registry is assembled at authoring time and connect time from installed packs and provides:

- Static signatures for functions and operators under a namespaced identity
- Type inference and nullability rules reusable by lane DSLs
- Deterministic rendering hooks scoped to adapter profiles
- Capability gating so invalid usage fails early with stable errors
- Plan references so policies and adapters can reason about usage without parsing SQL

### Goals

- Keep core small and target agnostic
- Ensure deterministic builds and stable Plan hashing
- Make CI and agents productive without DB access
- Allow community packs to add high-quality, type-safe APIs

### Non-goals

- No runtime evaluation of functions in CI or preflight
- No global registry service or network resolution

## Scope

- Relational DSL only
- Functions and infix/prefix/postfix operators
- Type inference, nullability, volatility metadata
- Rendering to SQL for supported adapter profiles
- Capability negotiation and early failure
- Raw SQL lane remains an escape hatch without registry enforcement

## Model

### Identity

Each function/operator is identified by a pack namespace and symbol name:

- **Example ids**:
  - `pgvector.fn.distance`
  - `pgvector.op.<->`
  - `postgis.fn.ST_DWithin`
- Overloads are disambiguated by a signature id within the symbol

### Signature

A pack declares one or more signatures per symbol:

```typescript
type ScalarType =
  | { kind: 'core', name: 'int4' | 'text' | 'float8' | 'bool' | 'timestamptz' | ... }
  | { kind: 'pack', namespace: 'pgvector', name: 'vector', params?: Record<string, unknown> }

interface ArgSpec {
  name: string
  type: ScalarType | { kind: 'array', of: ScalarType }
  nullable: boolean
  variadic?: boolean
  coerce?: ('int4'|'float8'|'text'|string)[]
}

interface ReturnSpec {
  type: ScalarType
  nullable: boolean | 'nullIfAnyArgNull'
}

type Volatility = 'immutable' | 'stable' | 'volatile'

interface FnSignature {
  id: string
  kind: 'function' | 'operator'
  symbol: string
  namespace: string
  args: ArgSpec[]
  returns: ReturnSpec
  volatility: Volatility
  deterministic: boolean
  costHint?: 'cheap' | 'normal' | 'expensive'
  requiresCaps?: string[]
}
```

### Rendering

Packs provide deterministic renderers keyed by adapter profile:

```typescript
interface RenderCtx {
  profile: string // e.g., 'postgres@15'
  quoteIdent(id: string): string
  cast(expr: SqlExpr, target: string): SqlExpr
}

interface Renderer {
  canRender(profile: string): boolean
  renderCall(sig: FnSignature, args: SqlExpr[], ctx: RenderCtx): SqlExpr
}
```

- For functions the default is `symbol(args...)`
- For operators the default is `arg0 OP arg1` with parentheses as needed
- Renderers can inject casts, schema qualification, or rewrite to equivalent SQL

## Registry assembly

### Authoring

- The emitter loads packs and builds a registry catalog for type checking and error messages
- The contract can reference functions/operators in annotations or lane hints but does not embed the registry code

### Runtime

- On connect, adapter advertises capabilities per ADR 065
- Runtime loads installed packs and filters signatures and renderers to those supported by the active profile
- If a Plan references a symbol requiring unsupported capabilities, execution fails with a stable error

## Lane DSL integration

Extension functions and operators surface through the `fns` proxy passed to
builder callbacks. The proxy is populated from the `QueryOperationRegistry`,
so pack-contributed entries like pgvector's `cosineDistance` appear alongside
the built-ins with full type inference:

```typescript
db.item
  .where((f, fns) => fns.lt(fns.cosineDistance(f.embedding, vector), 0.8))
  .orderBy((f, fns) => fns.cosineDistance(f.embedding, target))
```

- Overload resolution uses registry signatures with explicit, deterministic coercion rules supplied by packs
- Result types and nullability are inferred from the chosen signature
- Plans add structured function/operator refs to `meta.refs` for policy and hashing
- Parameter binding for prepared statements is driven by the codec
  registry — see ADR 210 for the `runtime.prepare(declaration, callback)`
  form that replaces the older `param.vector('v')` helper.

## Verification and capabilities

- During build, the DSL validates that the requested symbol exists and arguments type-check
- During connect, runtime verifies adapter capabilities and pack presence
- On execute, the adapter uses the renderer to produce SQL or raises `E_FN_RENDER_UNSUPPORTED`

## Stable error codes extend ADR 027

- **E_FN_UNKNOWN_SYMBOL**: no such symbol in loaded packs
- **E_FN_NO_MATCHING_OVERLOAD**: arguments do not match any signature
- **E_FN_CAPABILITY_MISSING**: adapter lacks required capability
- **E_FN_RENDER_UNSUPPORTED**: renderer not provided for current profile

## Plan hashing and refs

- Plan hashing per ADR 013 ignores the lane but includes a normalized list of function/operator references in `meta.refs`
- `{ ns, symbol, signatureId }` sorted and de-duplicated
- This allows policy to, for example, reject certain operators in WHERE without parsing SQL

## Lint and policy

- Packs may ship lint rules that refer to their symbols
  - `pgvector/require-ivfflat-index-for-<->`
  - `postgis/no-volatile-in-predicate`
- Policies can key off signature metadata like `volatility: 'volatile'` or `costHint: 'expensive'`

## Security and determinism

- Registry contents are pure data plus pure rendering functions
- No network, no filesystem access, no introspection at runtime
- CI and hosted preflight rely on registry metadata and annotations rather than DB introspection

## Performance

- Registry lookup and overload resolution are O(k) in number of overloads per symbol
- Results are cached per symbol and adapter profile within a process
- Rendering adds negligible overhead compared to SQL emission

## Conformance and testing

Conformance Kit additions:

- Signature schemas validate and canonicalize deterministically
- Golden SQL cases per profile
- Type inference fixtures per overload and coercion path
- Capability gating fixtures that must fail early with stable codes

## Versioning

- Adding a new overload is a minor change
- Changing argument or return types of an existing signature is breaking
- Changing rendering semantics for a profile is breaking
- Symbols are namespaced by pack and follow the pack's semver

## Alternatives considered

- **Hardcoding popular functions/operators in core**
  - Rejected as it breaks extensibility and slows innovation
- **Treating functions as raw SQL strings in DSL**
  - Rejected due to loss of type safety and policy awareness
- **DB-introspection to discover functions at runtime**
  - Rejected for determinism and CI parity reasons

## Consequences

### Positive

- First-class, type-safe access to advanced database features
- Deterministic lowering across adapters with clear failure modes
- Packs unlock rich ecosystems without bloating core

### Negative

- Pack authors must maintain signature catalogs and renderers for profiles they support
- Users must install packs in authoring contexts and runtime where symbols are used
- Some advanced overload matching rules may be complex to communicate

## Open questions

- Do we want pack-provided cost models to influence EXPLAIN budgets beyond `costHint`
- Should we allow packs to declare index class relationships for advisors
- Is there a minimal shared coercion lattice across packs for predictable overload resolution

## References

- ADR 112 Target Extension Packs
- ADR 065 Adapter capability schema & negotiation v1
- ADR 016 Adapter SPI for lowering relational AST
- ADR 020 Result typing and projection inference rules
- ADR 010 Canonicalization rules for contract.json
- ADR 104, 105, 106 Extension encoding and canonicalization
- ADR 018 Plan annotations schema and validation
- ADR 022 Lint rule taxonomy & configuration model
