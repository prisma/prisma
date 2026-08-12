# ADR 118 — Bundle inclusion policy for packs

## Context

Preflight-as-a-service (PPg) validates migrations and query Plans using a hosted Postgres cluster. Many apps depend on server extensions like pgvector or PostGIS. These capabilities live on the database, not in the application bundle. The preflight service must know which packs are required, ensure matching capabilities are present, and execute deterministically without cloning user repos or fetching packages.

## Problem

- Hosted preflight needs to provision shadows with the right extensions and versions
- Bundles must be self-contained, with no network or registry access, yet convey required packs and capabilities
- Results must be consistent with local preflight and reproducible across runs and environments
- Security boundary must prevent arbitrary code execution and supply-chain risks

## Decision

Define a strict bundle inclusion policy for packs that is declaration-only. Bundles enumerate required packs and capabilities but never include server-side binaries. PPg maintains a curated catalog of available packs per region and negotiates capabilities at job start. Plans and migration ops must annotate capability requirements so guardrails and provisioners can validate upfront.

## Bundle structure updates

A preflight bundle must include the following pack artifacts:

- `contract.json` canonical data contract with `coreHash`
- `bundle.json` index with `coreHash`, `profileTarget` (e.g. `postgres@XX`), list of edges and plan manifests
- `packs/manifest.json` pack declarations and resolved requirements
- `plans/**/*.json` or ndjson for recorded Plans, each with annotations per ADR 018
- `migrations/*/migration.json` migration definitions and node tasks with op IDs and args
- `ops/*.js` custom operation implementations when present, plus `ops/*.manifest.json` per ADR 041
- `fixtures/**` optional seed for shadow runs

**No server extension binaries, installers, or network references allowed**

## packs/manifest.json schema

```json
{
  "target": "postgres",
  "packs": [
    {
      "id": "pgvector/pgvector",
      "version": "0.7.2",
      "requires": {
        "ext.pgvector.version": ">=0.6.0",
        "ext.pgvector.metric.cosine": true
      },
      "prefers": {
        "ext.pgvector.index.hnsw": "try"
      }
    },
    {
      "id": "postgis/postgis",
      "version": "3.4.2",
      "requires": {
        "ext.postgis.version": ">=3.3.0"
      }
    }
  ],
  "derivedFrom": {
    "coreHash": "...",
    "generator": "prisma-next@1.0.0",
    "capabilityKeysUsed": [
      "ext.pgvector.metric.cosine",
      "ext.postgis.version",
      "sql.concurrentIndex"
    ]
  }
}
```

- `id` follows ADR 112 identity `vendor/name`
- `requires` and `prefers` use capability keys from ADR 117
- `derivedFrom` documents provenance and the exact capability keys referenced during local analysis

## Policy enforcement

On bundle ingestion PPg performs:

1. **Schema validation**
   - Validate `packs/manifest.json` against the published JSON schema

2. **Catalog check**
   - Ensure each `id@version` exists in the PPg regional catalog and is installable

3. **Capability negotiation**
   - Discover actual capabilities on the target cluster per ADR 117 and compute a negotiated profile

4. **Requirement match**
   - Verify `requires` are satisfied, honor `prefers` where possible, emit actionable warnings when not

5. **Plan and op gating**
   - For each Plan and migration op, verify annotated `requiresCapabilities` are satisfied before execution

6. **Profile hash comparison**
   - Recompute `profileHash` from negotiated capabilities and compare to optional bundle `profileHash`. Mismatch yields a warning or failure depending on policy

## What is included vs excluded

### Included

- Pack declarations and capability requirements
- References to extension-specific operators or types in Plan annotations
- Optional declarative guardrail policies shipped by packs (JSON), evaluated by PPg guardrail engine

### Excluded

- Extension binaries or installers
- Any code from packs, except custom migration ops explicitly bundled as isolated ESM per ADR 041
- Network endpoints, dynamic imports, or transitive fetches

## Hosted catalog

- PPg maintains a per-region catalog of pack IDs and versions with installation recipes and capability maps
- Catalog changes update the negotiated capabilities. If this alters `profileHash`, PPg surfaces a drift advisory to the user
- Regional differences are documented and returned in negotiation diagnostics

## Determinism and hashing

- `packs/manifest.json` is canonicalized per ADR 106
- `profileHash = sha256(canonicalize(negotiatedCapabilities))`
- If a bundle carries a locally computed `profileHash`, PPg compares and reports parity. Enforcement policy defaults to warn in preflight and fail in promotion gates

## Preflight behavior matrix

- **Shadow mode**: PPg provisions a shadow DB with required packs enabled. If a required pack is unavailable in the region, the job fails with `E_PACK_UNAVAILABLE`
- **EXPLAIN-only mode**: Requires the same capability profile to produce realistic plans. If packs are unavailable, PPg fails with `E_CAPABILITY_NEGOTIATION_FAILED` rather than attempting a degraded parse-only mode

## Security and privacy

- No network or registry access during preflight
- Only declared ESM custom ops run in a sandbox per ADR 040
- Bundle content is signed per ADR 051 combined and verified before execution
- No raw data persisted beyond diagnostics allowed by ADR 024

## Local parity

- The same `packs/manifest.json` is produced locally by the CLI when building a bundle
- Local preflight negotiates capabilities against the developer database and records a `profileHash`
- Differences between local and PPg negotiation are surfaced as diagnostics with remediation advice

## Alternatives considered

- **Bundling extension binaries or container images**
  - Rejected due to security, portability, and operational overhead
- **Inferring packs solely from SQL text**
  - Rejected as brittle and incomplete, especially for migration ops and guardrails

## Consequences

### Positive

- Deterministic, declaration-only packs make preflight reproducible and secure
- Clear parity story between local and hosted environments
- Lanes and planners branch on capabilities, not targets, keeping code portable

### Negative

- Users must manage a small additional manifest
- Regional catalog differences can block preflight until enabled

## Open questions

- Should PPg allow opt-in degraded EXPLAIN without extensions for limited lint-only scenarios
- Do we expose an API to preview regional pack availability and capability maps for IDE tooling
- How do we version and deprecate capability keys across pack releases without breaking existing bundles
