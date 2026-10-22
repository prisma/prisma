# 0017 — No CommonJS

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Publish CommonJS entry points so `require()` works, or support a `"type": "commonjs"` project.

## The decision

Prisma 8 is ESM-only. Every published package is `"type": "module"` and ships only `.mjs` entry points. ADR 222 lists this among the version support constraints.

## What to use instead

Use ES modules.

## Revisit if

ADR 222 lowers a version floor only "when a concrete user need justifies it". It states no condition for the module system specifically.

## Sources

- [ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)
- [Supported Versions, Module system](../../Supported%20Versions.md#module-system)
