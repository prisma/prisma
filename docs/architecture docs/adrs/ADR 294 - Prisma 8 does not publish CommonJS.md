# ADR 294 — Prisma 8 does not publish CommonJS

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 222 — Version support policy](ADR%20222%20-%20Version%20support%20policy.md)

---

## Decision

Prisma 8 is ESM-only. Every published package is `"type": "module"` and ships only `.mjs` entry points. Use instead: ES modules.

## Context

Users ask for CommonJS entry points so `require()` works, or for support for a `"type": "commonjs"` project. [ADR 222](ADR%20222%20-%20Version%20support%20policy.md) lists ESM-only among the version support constraints ([Supported Versions, Module system](../../Supported%20Versions.md#module-system)).

## Consequences

[ADR 222](ADR%20222%20-%20Version%20support%20policy.md) lowers a version floor only "when a concrete user need justifies it". It states no revisit-if condition for the module system.
