# @prisma/orm-toolchain

Prisma Next's development and build tooling: the `prisma-next` CLI (this package carries the bin), the contract emitter, the config loader, the language server, CLI telemetry, and the Vite plugin.

Applications get it as an exact-pinned dependency of their database facade (`@prisma/orm-postgres`, `@prisma/orm-sqlite`, `@prisma/orm-mongo`); app developers install the facade, not this package. It is separate from `@prisma/orm-framework` so deployed applications never trace a compiler, formatter, or language server into their runtime bundle.

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/cli` | CLI programmatic surface and command modules (the `prisma-next` bin runs the same code) |
| `/emitter` | contract emitter |
| `/config-loader` | `prisma-next.config.ts` loading |
| `/language-server` | PSL language server |
| `/migration-tools` | migration graph, packages, refs, IO |
| `/cli-telemetry` | CLI telemetry |
| `/vite-plugin-contract-emit` | Vite plugin for contract emission |
| `/publish-surface` | the published-surface model as a whole |
| `/publish-surface/shells` | the map from internal package to published entrypoint (ADR 242) |
| `/publish-surface/import-roots` | import-root resolution: which package name emitted code should carry |

## Responsibilities

Everything that runs at development or build time: emitting contracts, loading config, planning and packaging migrations, editor support, and the CLI itself. Nothing here is needed by a deployed application at runtime.

## Dependencies

`@prisma/orm-framework` (exact lockstep pin) plus the tooling's third-party dependencies (esbuild, prettier, clipanion, vscode-languageserver, and friends) — the deliberate reason this package is not part of `orm-framework`.
