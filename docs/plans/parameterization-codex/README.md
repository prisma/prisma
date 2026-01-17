# Schema-Aware Parameterization (Codex)

This directory documents a fresh, schema-driven design for query parameterization
using DMMF `isParameterizable` metadata and type-aware runtime checks. It is
intended to replace the heuristic-based parameterizer and provide fast, correct
query plan cache keys.

## Goals

- Parameterize only when the schema allows and the runtime value matches the
  expected type (scalar vs object vs enum vs FieldRef).
- Skip whole branches that are statically known to contain no parameterizable
  leaves.
- Preserve distinct cache keys for union shape differences (shorthand vs
  explicit filters, FieldRef vs scalar, etc.).
- Keep runtime overhead minimal (single pass, tiny data structure, no DMMF at
  runtime).

## Non-Goals

- Changing the query compiler or engine behavior (already implemented in
  prisma-engines).
- Adding new public API surface. This is internal to the generated client.

## Summary of the Approach

1. **Compile DMMF into a compact ParamGraph** with two node families:
   - **Input nodes** for argument objects and input types
   - **Output nodes** for selection traversal (nested `arguments`)

2. **Runtime parameterizer walks the JsonQuery tree** guided by ParamGraph:
   - Parameterize scalars only when the field allows it and the value matches
     the expected type category.
   - Recurse into objects only when the field points to a child node.
   - Treat FieldRef and structural enum tags as structural (never parameterize).
   - Handle unions by encoding both scalar and object possibilities on the same
     edge, keyed by runtime value class.

3. **Embed ParamGraph in the generated client** and pass it into the
   ClientEngine to replace the heuristic parameterizer (with legacy fallback).
   The runtime builds a `ParamGraphView` once in `getPrismaClient` to provide a
   readable API on top of the compact graph.

## Documents

- `01-paramgraph-design.md` - data structure and encoding
- `02-runtime-parameterizer.md` - traversal algorithm and rules
- `03-schema-generation.md` - compilation from DMMF
- `04-task-breakdown.md` - concrete tasks and file changes
- `05-open-questions.md` - decisions to confirm
- `06-typed-placeholders-client.md` - follow-up task (not in initial implementation)
