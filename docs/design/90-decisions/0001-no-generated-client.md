# 0001 — No generated client code

> **Draft — for maintainer acceptance.**

**Status:** `never`

## The request

Run a `prisma generate` step that writes a JavaScript client, as Prisma 7 does. Or emit client code for each model, or small JavaScript stubs beside the types.

## The decision

The contract emitter writes `contract.json` and `contract.d.ts` and never ships generated JavaScript. Queries are built at runtime from the contract. ADR 007 rejected a generated JavaScript client because it hides the contract from agents and tools and complicates bundling, and rejected a hybrid of small stubs plus types because it keeps the cost of code generation without solving type inference. ADR 019 rejects a generated client for TypedSQL for the same reason.

## What to use instead

Import the emitted contract and pass it to the client. Use cases that Prisma 7 generators served, such as validators, GraphQL schemas or test factories, are libraries that read the contract at runtime ([community generator analysis](../../reference/community-generator-migration-analysis.md)).

## Revisit if

The ADR records no condition.

## Sources

- [ADR 007](../../architecture%20docs/adrs/ADR%20007%20-%20Types%20Only%20Emission.md)
- [ADR 019](../../architecture%20docs/adrs/ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md)
- [feature request template](../../../.github/ISSUE_TEMPLATE/feature_request.yml), which names "emit imperative client code" as an example that will not land
