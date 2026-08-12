# ADR 165 — ORM `WhereArg` literal normalization

## Context

We want different “authoring surfaces” (ORM, raw SQL, etc.) to be able to pass a filter into the ORM without importing each other’s types.

To do that, the ORM accepts a union:

- `WhereArg = WhereExpr | ToWhereExpr`

Where:

- **`WhereExpr`** is a *parameter-free* filter expression (it contains only literals like `"admin"`, not placeholders).
- **`ToWhereExpr`** is an object with a method `toWhereExpr()` that returns a *bound* filter payload:
  - `expr`: a filter expression that may contain **parameter references** (placeholders)
  - `params`: the values to bind to those placeholders
  - `paramDescriptors`: metadata about those params (source, type hints, etc.)

Today, `@internal/sql-orm-client` stores its internal filters as **parameter-free** AST fragments. That makes filter composition predictable (merge `and/or/exists`, reuse filters across operations, etc.).

## Problem

When the ORM receives a `ToWhereExpr`, it has to decide what to do with the bound payload.

We need behavior that:

- keeps interop working (so lanes can provide filters)
- keeps ORM internals low-risk for this release
- rejects malformed payloads early (no “silently bind the wrong value to the wrong placeholder”)

## Options

### Option A: Normalize to literals (this ADR)

Convert the bound payload into a parameter-free `WhereExpr` immediately by replacing each parameter reference with its corresponding literal value.

### Option B: Preserve bound params through ORM composition (future)

Carry `{ expr, params, paramDescriptors }` through ORM composition, then re-index/re-bind at plan assembly time. This is viable, but it changes internal semantics broadly and raises merge risk.

## Constraints

- Current scope prioritizes architectural extraction and compatibility stability.
- ORM’s internal model is currently parameter-free.
- Interop payloads must be validated rigorously.
- Preserving param descriptors through composition is desirable, but not required for this release.

## Decision

For this release, the ORM consumes `ToWhereExpr` via **literal normalization**.

### 1) Validate the bound payload

Before doing any conversion, enforce these invariants:

- `params.length === paramDescriptors.length`
- `ParamRef` indices start at `1`
- `ParamRef` indices are contiguous (no gaps)
- the maximum `ParamRef` index equals `params.length`

### 2) Substitute parameters with literals

Replace each `ParamRef(index)` inside `expr` with `LiteralExpr(params[index - 1])`.

### 3) Keep ORM internal state parameter-free

After normalization, the ORM stores the result as a plain `WhereExpr` (no `ParamRef`).

### 4) Do not propagate `paramDescriptors` into ORM plan metadata

Descriptors are validated for alignment/integrity, but not carried through plan metadata in this release.

## Consequences

### Positive

- Fits the current ORM model (parameter-free internal filters).
- Enables lane-agnostic interop immediately.
- Makes incorrect payloads fail loudly and early.

### Trade-offs

- We lose the ability (for now) to preserve descriptor-rich, prepared-statement-like semantics through ORM composition.
- A future “bound-param-preserving” design will require a deliberate follow-up (carry + reindex).

## Example

```ts
const whereArg = {
  toWhereExpr: () => ({
    expr: {
      kind: 'bin',
      op: 'eq',
      left: { kind: 'col', table: 'users', column: 'kind' },
      right: { kind: 'param', index: 1 },
    },
    params: ['admin'],
    paramDescriptors: [{ source: 'lane' }],
  }),
};

// ORM behavior for this release:
// { kind: 'param', index: 1 } -> { kind: 'literal', value: 'admin' }
```

## Follow-up

Future work may evaluate:

- a bound-param-preserving ORM composition model (carry/reindex `params` + `paramDescriptors` instead of literal normalization)
- shared helpers for execution-plane PLAN.* error envelopes (for example PLAN.UNSUPPORTED)
