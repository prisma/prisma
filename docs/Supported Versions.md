# Supported versions

This page states the minimum versions of each runtime, database, and tool that Prisma Next supports. These are hard floors, not "tested with" suggestions: versions below the listed minimums are untested and unsupported.

See [ADR 222](./architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md) for the rationale and the policy that governs how these floors change over time.

## Runtime

| Runtime | Minimum version |
|---|---|
| Node.js | 24 |
| Bun | 1.2 |
| Deno | 2.0 |

Node.js is the primary supported runtime. Bun and Deno are supported on a best-effort basis; if you encounter a Bun- or Deno-specific issue, please file an issue and include your runtime version.

## Database servers

| Database | Minimum version |
|---|---|
| PostgreSQL | 17 |
| MongoDB | 8.0 |

The minimum version for each database is declared in the corresponding target package's `package.json` (`prismaNext.minServerVersion`) and mirrored in the CLI's `MIN_SERVER_VERSION` constant. A workspace-level test asserts these never drift. The `prisma-next init` scaffold generates a `.env.example` with a `# Requires <db> >= <version>` comment so fresh users see the requirement before they connect.

## TypeScript

**Minimum: 5.9**

TypeScript is declared as an optional peer dependency on every published package. "Optional" means Prisma Next does not require you to install TypeScript — plain-JS consumers are unaffected. When TypeScript is present, version 5.9 or newer is required to get accurate types.

The minimum TypeScript version is the source-of-truth constant `MIN_TYPESCRIPT_PEER` in `scripts/validate-typescript-peer.mjs`. A CI lint gate (`pnpm lint:manifests`) verifies that every publishable package's peer declaration matches this constant.

## Consumer `tsconfig` requirements

Your project's `tsconfig.json` must set:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

The `prisma-next init` command configures these automatically. If you are integrating Prisma Next into an existing project, the `prisma-next init --merge-tsconfig` flag applies these options non-destructively.

## Module system

Prisma Next is ESM-only. Every published package is `"type": "module"` and ships only `.mjs` entry points. CommonJS consumers (`require()`, `"type": "commonjs"`) are not supported.
