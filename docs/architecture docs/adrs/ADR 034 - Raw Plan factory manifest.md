# ADR 034 — Raw Plan factory manifest

## Context

Some lanes generate Plan factories as code artifacts, e.g. a TypedSQL CLI that turns `.sql` files into importable TypeScript functions. CI, PPg, and agents often need provenance and static metadata about those factories without executing application code.

We want a small, optional, machine-readable manifest emitted alongside generated factories so tools can attribute where a factory came from, which contract/profile it targets, and what policy annotations it claims.

## Problem

- Tooling cannot reliably map a Plan factory back to its source SQL or lane without executing user code
- Change detection for factories is ad hoc, making it hard to block unexpected SQL diffs in CI
- Agentes need parameter and result shapes to reason about factories, but those are buried in generated code

## Decision

Define an optional sidecar JSON manifest that lanes may emit when they generate Plan factories:
- The manifest is for tooling only (CI, PPg, agents, local diagnostics)
- The runtime never reads manifests to execute Plans
- A manifest accompanies the generated factory code and is regenerated with it
- Format is stable and diffable to support change detection

## Scope

### In scope
- Lanes that generate Plan factories as files, e.g. TypedSQL CLI output

### Out of scope
- Inline lanes that produce Plans in user code at call time, including the raw SQL escape hatch
- These produce no files, no manifest, and remain memory-only

## Placement

- Default path colocated with generated factories, for example `./generated/prisma/sql/factories.manifest.json`
- Lanes may also expose the manifest programmatically for in-memory ingestion by tools

## Versioning

- Manifest has its own version independent of lane or contract versions
- Prefer backward-compatible evolution with new optional fields

## Manifest schema

### Top level

```json
{
  "version": 1,
  "entries": [ /* FactoryEntry[] */ ]
}
```

### Factory entry

- **factoryId**: Stable identifier for the exported factory, e.g. `getUsersWithPosts`
- **lane**: Origin lane, e.g. `typed-sql`
- **origin**: Provenance for humans and tools
  - `sqlPath`: path to the source SQL file when applicable
  - `lineRange`: `[start, end]` when available
  - `sourceHint`: free-text hint for non-SQL sources
- **targetProfile**: Adapter and dialect profile expected by the factory, e.g. `postgres@15`
- **contract**: Binding to data contract and adapter profile
  - `coreHash`: data contract hash
  - `profileHash`: optional adapter/profile hash
- **plan**: Minimal normalized metadata consistent with ADR 011 and ADR 012
  - `annotations`: required raw plan annotations
  - `intent`: `read | write | admin`
  - `isMutation`: boolean
  - `hasWhere`: boolean
  - `hasLimit`: boolean
  - `refs` (optional): declared `{ tables: string[], columns: string[] }`
  - `projection` (optional): declared field aliases and types if known
- **types**: Machine-readable parameter and result shapes
  - `paramsSchema`: JSON Schema for input parameters
  - `resultSchema`: JSON Schema for row shape
- **fingerprints**: Hashes for change detection
  - `sqlFingerprint`: normalized SQL + param types hash
  - `factoryHash`: hash of the generated factory source
- **tooling**: Generator metadata
  - `generator`: name and version of the emitting tool
  - `generatedAt`: ISO timestamp
  - `sourceMap`: optional path to a source map for IDE and CI annotations

## Example

```json
{
  "version": 1,
  "entries": [
    {
      "factoryId": "getUsersWithPosts",
      "lane": "typed-sql",
      "origin": { "sqlPath": "prisma/sql/getUsersWithPosts.sql", "lineRange": [1, 20] },
      "targetProfile": "postgres@15",
      "contract": { "coreHash": "abc…", "profileHash": "def…" },
      "plan": {
        "annotations": { "intent": "read", "isMutation": false, "hasWhere": true, "hasLimit": false },
        "refs": { "tables": ["User", "Post"], "columns": ["User.id", "User.name", "Post.id"] }
      },
      "types": {
        "paramsSchema": { "$schema": "https://json-schema.org/draft/2020-12/schema", "type": "array", "prefixItems": [] },
        "resultSchema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "integer" }, "name": { "type": "string" }, "postCount": { "type": "integer" } },
            "required": ["id", "name", "postCount"]
          }
        }
      },
      "fingerprints": {
        "sqlFingerprint": "xxh3:5dd7e…",
        "factoryHash": "91bf…"
      },
      "tooling": {
        "generator": "typed-sql@0.2.1",
        "generatedAt": "2025-10-18T09:12:33Z",
        "sourceMap": "./generated/prisma/sql/getUsersWithPosts.map.json"
      }
    }
  ]
}
```

## How tools use the manifest

### CI and preflight
- Diff `sqlFingerprint` and `resultSchema` across commits
- Fail builds on unexpected SQL or shape changes for sensitive factories
- Attribute diagnostics to factory origins and surface annotations in PRs

### Agents
- Discover factories, read param and result schemas, and navigate to source SQL
- Keep edits in sync without executing application code

### PPg
- Display provenance, contract binding, and annotations in PR dashboards
- Power preflight-as-a-service without introspecting user bundles

## Privacy and safety

- No raw argument values or PII appear in the manifest
- Types and refs are structural and safe for CI
- Follow ADR 024 redaction rules for any optional fields that could expose sensitive info

## Alternatives considered

- **Embedding metadata as comments in generated TS**: Harder for CI and agents to read without executing or parsing TS
- **Making manifests mandatory**: Adds friction to lightweight lanes and local dev
- **Serializing Plans to disk**: Rejected to avoid drift, privacy risks, and confusion over sources of truth

## Consequences

### Positive
- Consistent, low-overhead provenance for factories across tools
- Stable change detection via fingerprints without executing user code
- Better agent UX and PPg visibility

### Negative
- Another artifact to version and document
- Potential staleness if not regenerated alongside factories

## Mitigations

- Emit the manifest in the same step that writes factory code
- Validate manifest presence and freshness in CI with a lightweight check

## Implementation notes

- Provide a shared JSON Schema for manifest validation in tooling packages
- Offer helpers to read and verify manifests in CI and PPg services
- Lanes that do not generate factories produce no manifest

## References

- ADR 011 — Unified Plan model across lanes
- ADR 012 — Raw SQL escape hatch with required annotations
- ADR 013 — Lane-agnostic Plan identity and hashing
- ADR 019 — TypedSQL as a separate CLI that emits Plan factories
- ADR 024 — Telemetry schema and privacy
- ADR 047 — Diagnostics artifacts and formats
