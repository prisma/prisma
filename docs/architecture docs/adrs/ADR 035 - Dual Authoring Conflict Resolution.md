# ADR 035 — Dual authoring conflict resolution

## Context

We now support two authoring modes for the data contract:
- **PSL-first**: author `schema.prisma`, emit canonical `contract.json` and `.d.ts`
- **TS-first**: author a pure data contract via `defineContract`, optionally emit canonical `contract.json`

Teams may temporarily keep both PSL and TS side by side during migration or experimentation. Without a policy, this creates ambiguity about which source is canonical and how tools should behave when the two diverge.

## Problem

- If PSL and TS disagree, which one should tools and CI trust?
- Dev loops must remain no-emit for TS-first while CI and hosted services require canonical JSON
- Auto "last writer wins" reconciliation risks silent drift and unstable hashes

## Goals

- A single canonical source of truth per repo configured explicitly
- Deterministic, auditable behavior when both PSL and TS exist
- Clear failure modes and an optional, explicit auto-reconcile only in developer tools
- Preserve the no-emit developer experience for TS-first while keeping tooling artifact-driven

## Decision

### Canonical source selection

Add a small config to declare the canonical authoring mode:

```typescript
// prisma-next.config.ts
export default defineConfig({
  contract: {
    authoring: 'ts' | 'psl' | 'json',  // canonical source
    paths: { ts: 'src/contract.ts', psl: 'prisma/schema.prisma', json: 'contracts/current.contract.json' }
  }
})
```

Default is `authoring: 'psl'` for existing repos and `'ts'` for new TS-first templates.

- **`authoring: 'psl'`**: PSL is the source of truth. TS contract modules, if present, are treated as derived and must round-trip to the same canonical JSON and coreHash
- **`authoring: 'ts'`**: TS contract object is the source of truth. PSL, if present, is treated as derived and must round-trip to the same canonical JSON and coreHash
- **`authoring: 'json'`**: Canonical JSON is the source of truth. PSL and TS are optional views that must match the committed canonical JSON when present

### CI behavior

- CI is artifact-driven and consumes canonical JSON only
- If authoring is `ts`, CI performs a sandboxed emit to canonical JSON and compares against any committed JSON
- If both PSL and TS exist, CI verifies they canonicalize to the same coreHash
- On mismatch, CI fails with a dual-authoring error and a structured diff at the canonical JSON level

### Dev behavior

- No-emit stays intact for TS-first app development
- Dev tooling may offer explicit auto-reconcile commands behind a prompt:
  - Fix TS from PSL when `authoring: 'psl'`
  - Fix PSL from TS when `authoring: 'ts'`
  - Regenerate canonical JSON from whichever is canonical
- Silent background reconciliation is not allowed

### Diff strategy

- Always diff canonical JSON for clarity and determinism
- Show sectioned diffs for tables, columns, indexes, foreignKeys, models if present
- Include coreHash before/after and a short summary of breaking vs additive changes

### Error vs auto-reconciliation

- **Default**: fail fast on divergence with `ERR_CONTRACT_DUAL_AUTHORING_DIVERGED`
- **Optional developer command**: `prisma-next contract reconcile --from psl --to ts` or the reverse
- CI never auto-reconciles

### Tooling rules

- Tools and PPg operate on canonical JSON per ADR 047
- Dual authoring is allowed only if the configured canonical source is present and consistent
- If the canonical source is missing, tools fail and point to the config

## Rationale

- Explicit canon makes pipelines predictable and auditable
- Canonical JSON provides a single comparison surface and stable hashing
- Optional, explicit developer-initiated reconciliation is safer than silent drift
- Keeps TS no-emit DX while satisfying artifact needs of CI and hosted services

## Consequences

### Positive
- Unambiguous source of truth and deterministic CI
- Safer migrations between authoring modes
- Clear developer workflows to reconcile when needed

### Negative
- Slight configuration overhead for mixed repos
- Teams must adopt the reconcile command rather than relying on implicit behavior

## Alternatives considered

- **Implicit precedence (e.g., PSL always wins)**: Rejected because teams intentionally moving to TS-first would be surprised
- **Always require an emit step**: Rejected to preserve no-emit DX for TS-first
- **Auto overwrite derived artifacts on save**: Rejected due to risk of silent drift and hard-to-debug changes

## Interaction with the no-emit strategy

### Not a conflict
- No-emit applies to application development when the canonical source is TS
- CI still materializes canonical JSON from TS in a sandbox for tools, as defined in ADR 100
- Dev auto-emit plugins may generate JSON on watch for local tools, but this is an optimization, not a requirement

## Implementation notes

- Extend CLI with `contract diff`, `contract reconcile`, and `contract verify` subcommands
- Emit a clear, single-line status in `pnpm dev` if dual authoring is detected and diverged
- Add a lint rule in `@prisma/eslint-plugin-contract` to flag files that look like contracts but conflict with authoring mode

## Testing

- Fixtures covering each authoring mode with matching and diverging PSL/TS inputs
- Golden canonicalization tests to ensure identical coreHash across modes when schemas are equivalent
- CI e2e tests that fail on divergence and pass on explicit reconcile

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 096 — TS-authored contract parity & purity rules
- ADR 097 — Tooling runs on canonical JSON only
- ADR 098 — Runtime accepts contract object or JSON
- ADR 100 — CI contract emission trust model
