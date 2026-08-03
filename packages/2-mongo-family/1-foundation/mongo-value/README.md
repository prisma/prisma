# @internal/mongo-value

Primitive value types and parameter references for the MongoDB family.

## Responsibilities

- **Value types**: `MongoValue`, `LiteralValue`, `MongoDocument`, `MongoArray`, `MongoExpr`, `MongoUpdateDocument`, `RawPipeline`, and `Document` — the shared vocabulary for all MongoDB expression and document types
- **Parameter references**: `MongoParamRef` — an immutable tagged reference carrying a runtime value, optional name, and codec ID for parameter binding during query lowering

## Dependencies

- **Depends on**: nothing (leaf package)
- **Depended on by**:
  - `@internal/mongo-query-ast` (filter expressions and pipeline stages)
  - `@internal/mongo-wire` (wire command payloads)
  - `@internal/mongo-codec` (codec encode/decode signatures)
  - `@internal/adapter-mongo` (lowering and driver integration)
