# @internal/language-server

> **Internal package.** This package is an implementation detail of Prisma 8 and is published only to support its runtime. Its API is unstable and may change without notice. Do not depend on this package directly; install `@prisma/cli` and a database facade (e.g. `@prisma/orm-postgres`) instead.

The Prisma 8 language server speaks the Language Server Protocol over stdio for PSL schema inputs declared in a project's `prisma.config.ts`. It is launched by the `prisma lsp` subcommand, so editor features come from the project's own Prisma 8 version and stay version-matched by construction.

The server only handles documents whose first non-whitespace content is a `// use prisma-8` line comment; all other documents belong to the legacy (Prisma ≤7) language server and are ignored per request from current document content. The check must stay byte-for-byte in sync with the legacy server's copy in `prisma/language-tools`.

## Responsibilities

- Serve diagnostics, whole-document formatting, folding ranges, semantic tokens, and completion for open configured PSL inputs carrying the directive.

## PSL completion scope

The completion provider uses the configured project's scalar types, PSL block descriptors, symbol table, and interpretation context. Attribute completion therefore comes from the same authoring contributions that interpretation uses rather than from a language-server-owned list of SQL, Mongo, target, or extension attributes.

Supported attribute completion contexts are intentionally shallow:

- Attribute names after `@` and `@@` for fields, models, and contributed PSL blocks.
- Top-level named argument keys inside an attribute call, excluding keys already supplied before the cursor.
- For clients that advertise LSP snippet support, attribute-name completions include only required positional arguments and required named arguments as empty editable tab stops. Optional arguments remain available through named-key completion instead of being inserted automatically.
- For clients without snippet support, attribute-name completions use plain-text edits with no snippet placeholders.

The provider preserves existing sigils, typed prefixes, completed attribute argument lists, and text after the cursor. It does not complete attribute values, recurse into record/list values, or offer nested function-call argument suggestions; those value-level completions are outside this package's current completion surface.
