# ADR 279 — Prisma 8 does not generate client code

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 007 — Types Only Emission](ADR%20007%20-%20Types%20Only%20Emission.md), [ADR 019 — TypedSQL as Separate CLI](ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md)

---

## Decision

The contract emitter writes `contract.json` and `contract.d.ts` and never ships generated JavaScript. Queries are built at runtime from the contract. Use instead: import the emitted contract and pass it to the client. Use cases that Prisma 7 generators served, such as validators, GraphQL schemas or test factories, are libraries that read the contract at runtime ([community generator analysis](../../reference/community-generator-migration-analysis.md)).

## Context

Users ask for a `prisma generate` step that writes a JavaScript client, as Prisma 7 does, or for client code per model, or for small JavaScript stubs beside the types. [ADR 007](ADR%20007%20-%20Types%20Only%20Emission.md) rejected a generated JavaScript client because it hides the contract from agents and tools and complicates bundling, and rejected a hybrid of stubs plus types because it keeps the cost of code generation without solving type inference. [ADR 019](ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md) rejects a generated client for TypedSQL for the same reason. The [feature request template](../../../.github/ISSUE_TEMPLATE/feature_request.yml) names "emit imperative client code" as an example that will not land.

## Consequences

Every tool that needs the schema reads the contract. [ADR 007](ADR%20007%20-%20Types%20Only%20Emission.md) records no revisit-if condition.
