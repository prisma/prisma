# ADR 129 — Template-Tagged Literals for Extensions

## Context

Packs need a way to accept rich, multi-line, domain-specific text inside PSL without expanding the core grammar for every feature. Examples include SQL view definitions, boolean predicates for partial indexes, RLS policy expressions, and specialized functions/operators. Prior ideas like fenced code blocks complicate parsing and determinism.

## Decision

Adopt template-tagged string literals as the single mechanism for extension-owned textual payloads.

- Syntax: a qualified tag followed by a backtick literal, e.g. `pg.sql` or `pg.predicate`
- No interpolation allowed
- Core performs canonicalization and routes the literal to the owning pack
- Packs validate and normalize content deterministically and return a JSON payload embedded in the contract under `ext`

## Syntax

Informal grammar:

```
TaggedLiteral := QualifiedIdent  TemplateLiteral

QualifiedIdent := Identifier ('.' Identifier)*

TemplateLiteral := '`' { any char except unescaped '`' and the sequence '${' } '`'
```

Rules:

- Tag must be a qualified identifier `<pack>[.<flavor>]`
- `${` is a hard error unless escaped as `\${}`
- Backticks inside the body must be escaped as ``\```

## Canonicalization

Core canonicalizes all tagged literals before invoking packs:

- Normalize line endings to `\n`
- If the first line is blank, drop it
- If the last line is blank, drop it
- Dedent by the smallest common leading whitespace across all non-blank lines
- Preserve internal blank lines
- No trailing newline added
- Reject `${` (unescaped) and NUL (`\0`) characters
- Enforce a configurable byte limit, default 64 KiB

## AST node

```ts
type TaggedLiteralNode = {
  kind: 'TaggedLiteral'
  tag: string           // e.g. 'pg.sql', 'pg.predicate'
  canonicalBody: string // canonicalized form
  rawBody: string       // as authored, for diagnostics only
  span: SourceSpan
}
```

## Contract encoding

Encoded under an `ext` wrapper owned by the pack:

```json
{
  "ext": {
    "pack": "pg",
    "tag": "predicate",
    "body": "(status = 'active') AND (created_at > now() - interval '7 days')",
    "bodyHash": "…"
  }
}
```

Notes:

- `body` is the canonical form
- `bodyHash` participates in diffing and planner decisions
- Packs must not rely on `rawBody`

## Validation lifecycle

- Parse time: core enforces syntax, no interpolation, canonicalizes, and builds `TaggedLiteralNode`
- Emit time: core routes node to the owning pack by tag prefix
- Pack validation: pack validates semantics (e.g., “must be a boolean SQL expression”) and returns a deterministic JSON payload
- Contract build: payload is embedded under an `ext` property or normalized into a richer structured field as defined by the pack

## Lints & guardrails

- `extensions.noInterpolation`: error on `${`
- `extensions.maxLiteralBytes`: default 64 KiB
- Optional context lints provided by packs, e.g. `extensions.pg.forbidSemicolonInExpr`, `extensions.pg.disallowDDLInPredicate`

## Editor integration

- Language injection guided by the tag (e.g., `pg.sql`, `pg.predicate`)
- Formatters must not modify literal interiors; canonicalization is owned by the emitter
- Diagnostics should point to the span of the literal; suggestions remain outside the literal body

## Consequences

- Deterministic, pack-owned semantics without growing core grammar
- Precise error spans and simple, stable diffs via `bodyHash`
- Consistent contract encoding that agents and tools can reason about

## Out of scope

- Executing or interpreting literal bodies in core
- Allowing interpolation or environment-dependent evaluation

## References

- ADR 104 — PSL extension namespacing & syntax
- ADR 105 — Contract extension encoding
- ADR 106 — Canonicalization for extensions
- ADR 112 — Target Extension Packs
- ADR 115 — Extension guardrails & EXPLAIN policies


