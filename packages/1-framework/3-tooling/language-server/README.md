# @internal/language-server

> **Internal package.** This package is an implementation detail of Prisma 8 and is published only to support its runtime. Its API is unstable and may change without notice. Do not depend on this package directly; install `@prisma/cli` and a database facade (e.g. `@prisma/orm-postgres`) instead.

The Prisma 8 language server speaks the Language Server Protocol over stdio for PSL schema inputs declared in a project's `prisma.config.ts`. It is launched by the `prisma lsp` subcommand, so editor features come from the project's own Prisma 8 version and stay version-matched by construction.

The server only handles documents whose first non-whitespace content is a `// use prisma-8` line comment; all other documents belong to the legacy (Prisma ≤7) language server and are ignored per request from current document content. The check must stay byte-for-byte in sync with the legacy server's copy in `prisma/language-tools`.

## Responsibilities

- Serve diagnostics, whole-document formatting, folding ranges, semantic tokens, and completion for open configured PSL inputs carrying the directive.

## PSL completion scope

The completion provider uses the configured project's scalar types, PSL block descriptors, symbol table, and interpretation context. Attribute completion therefore comes from the same authoring contributions that interpretation uses rather than from a language-server-owned list of SQL, Mongo, target, or extension attributes.

Supported attribute completion contexts include:

- Attribute names after `@` and `@@` for fields, models, and contributed PSL blocks.
- Named argument keys inside attributes and nested function calls, in signature declaration order, excluding supplied keys while allowing replacement of the current key.
- Fixed identifiers, fixed string/number literals, booleans, and declared function calls. Every union alternative contributes candidates; equivalent edits are deduplicated, while alternatives with different insertions remain available.
- List elements and record values, recursively using their child combinators, including unfinished calls and missing-expression collection gaps.
- Local field references from the declaring model and referenced fields from the relation target. Explicit namespaces resolve only within that namespace. Unqualified targets resolve in the declaring namespace before the top level. Missing, malformed, or foreign-contract-space targets produce no referenced-field suggestions; unrelated namespaces are never searched.
- For clients that advertise LSP snippet support, attribute and function completions include only required positional and named arguments as empty editable tab stops. Optional arguments remain available through named-key completion instead of being inserted automatically. Existing call parentheses and arguments are preserved.
- For clients without snippet support, attribute and function names use plain-text edits without snippet placeholders.

For example, SQL enum defaults offer the enum's declared members, configured default functions expose their argument signatures, and Mongo index field functions offer their declared `sort` values. These suggestions come from the configured factories, not family-specific completion tables.

The provider preserves existing sigils, token boundaries, completed argument lists, and surrounding text. It offers no completions inside comments or in trailing trivia after a completed scalar/callee. Unrestricted strings, numbers, integers, JSON, entity references, arbitrary record keys, and rejecting combinators do not invent values. Cross-contract symbol discovery and unrelated generic-block parameter-value completion remain unsupported.

Typing `@` or `@@` triggers attribute-name completion automatically. At value or nested argument positions, invoke the editor's completion command (for example, Ctrl+Space); these positions do not introduce additional trigger characters.
