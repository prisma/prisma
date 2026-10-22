# 0018 — No new features on Prisma 7

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Add a feature to Prisma 7, through a pull request against the `v7` or `7.9.x` branch.

## The decision

Prisma 7 receives bug fixes and security updates for eighteen months after `8.0.0` final, and nothing else. Features do not land on the 7.x line.

## What to use instead

Propose the feature against `main`, for Prisma 8. Move the application to Prisma 8 incrementally; Prisma 8 can read the Prisma 7 schema as its contract source (ADR 252).

## Revisit if

None. The maintenance window ends eighteen months after `8.0.0` final.

## Sources

- [PR triage, step 2](../../oss/pr-triage.md#step-2--is-it-in-scope-for-that-line)
- [README](../../../README.md)
- [SECURITY.md](../../../SECURITY.md)
- [ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)
