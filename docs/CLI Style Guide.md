# Prisma Next CLI Style Guide

This guide defines how Prisma Next's CLI behaves and looks. It exists to keep our developer experience consistent across commands and packages while aligning with our architecture: contract‑first, deterministic, agent‑friendly.

For the architectural view of the CLI (distribution, command surface, init pipeline, programmatic API, layering), see the [CLI subsystem doc](architecture%20docs/subsystems/11.%20CLI.md).

## Principles
- Human‑first TTY output; CI/agents get deterministic, parseable output.
- Deterministic behavior: stable exit codes, structured error codes, and JSON schemas.
- Actionable feedback: every error tells the user why it happened and what to do next.
- Respect boundaries: migration vs runtime plane, and family hooks for family‑specific logic.
- Minimal ceremony: tasteful color/symbols; clack-like decorations are ok; banners only for `init`.

## Command Taxonomy
- Group commands by domain/plane with noun → verb phrasing.
  - `contract emit`
  - `migration plan | check | status`
  - `db verify | sign`
- Aliases: we will add flat verb aliases later for common flows, but the canonical shape is domain‑first.
- No colon (`db:sign`) forms; prefer space‑separated subcommands. Optional short group aliases (e.g., `db`) are fine; avoid long forms (e.g., `database`).

## Output Style
- Tone: friendly‑approachable, polished, concise. Symbols only (no emojis).
- Symbols: success `✔`, error `✖`, warn `⚠`, info `ℹ`, step `›`, arrow `→`.
- Colors: success=green, error=red, warn=yellow, info=cyan, accent=magenta, secondary text=dim.
- Paths: Show relative paths from current working directory (not absolute paths) for better readability
- Banners: only for `init` (first‑run experience). Otherwise, focus on getting work done.
- Respect `NO_COLOR`, auto‑disable color/spinners in non‑TTY and CI. Use `--color` flag to force color when needed.

## Output Conventions: Composable CLI Output

The CLI follows the Unix convention of separating human-readable decoration from machine-readable data:

- **stdout** — the data the caller asked for. This is what scripts and pipes capture. Includes successful `ui.output()` payloads, `--version` output, and explicitly-requested `--help` (see below).
- **stderr** — decoration around some other operation (Clack spinners, logs, notes, intro/outro), warnings, errors, and help printed as part of an error (e.g. unknown-command usage hints). Visible in terminal, invisible in pipes.

### Rules

1. **All `TerminalUI` methods except `output()` write to stderr** via Clack's `{ output: process.stderr }` option — but only in interactive mode.
2. **`ui.output(data)` always writes to stdout** — call it only when there is data to emit (e.g., `--json` responses). Commands gate `ui.output()` behind `if (flags.json)`.
3. **When stdout is piped, ALL decoration is suppressed** — `isInteractive` (`process.stdout.isTTY`) gates every decoration method. Only `ui.output()` writes in piped mode. This keeps `prisma-next db verify | jq` completely silent.
4. **Action commands** (sign, init) produce no stdout data — they are purely decorative.
5. **Data commands** (verify, emit, introspect, status) call both decoration (stderr) and `ui.output()` (stdout). In interactive mode, decoration is visible on stderr; `ui.output()` writes to stdout only when the command has data to emit (gated by `--json`).
6. **Never write data to stderr** — decoration methods are for human context only.
7. **Never write decoration to stdout** — it breaks pipes, `$(...)` captures, and `> file` redirects.
8. **`--help` and `--version` are data when explicitly requested.** When the user invokes `prisma-next --help` (or any subcommand `--help`) or `prisma-next --version`, the rendered text **is** the data the caller asked for and goes to **stdout** with exit code 0. This makes `prisma-next --help | less`, `prisma-next --help > usage.txt`, and `diff <(prisma-next --help) <(prisma-next --version)` all work as expected — matching POSIX, GNU coreutils, git, and npm. **Help printed as part of an error** (unknown command, missing subcommand, bad flag) is decoration around that error and goes to **stderr** with the corresponding non-zero exit code. The user did not invoke `--help` in those cases — the CLI is voluntarily showing usage to help them recover, which is decoration. Same printed bytes; different invocation intent; different stream.

### How it works in practice

The CLI checks `process.stdout.isTTY` once at startup to determine the output mode:

- **Interactive** (`stdout` is TTY): decoration visible on stderr. `ui.output()` writes to stdout when called (commands gate it behind `--json`).
- **Piped** (`stdout` is NOT TTY): decoration suppressed, `ui.output()` writes raw data to stdout.

## Verbosity & Flags
- Defaults: concise informational output in TTY with tasteful color/spinners.
- Quiet: `-q/--quiet` (errors only).
- Verbose: `-v/--verbose` (debug: timings, resolved config), `--trace` (deep internals, stack traces).
- JSON: `--json` outputs single JSON object to stdout.
- Interactivity: `--interactive`/`--no-interactive`. Defaults to `process.stdout.isTTY`. `-y/--yes` accepts prompts.
- Env toggles: `PRISMA_NEXT_DEBUG=1` ≅ `-v`, `PRISMA_NEXT_TRACE=1` ≅ `--trace`.
- CLI flags take precedence over env vars.

> **Future**: If long-running streaming commands are introduced, `--json` may auto‑select NDJSON for those commands, and `--json=object|ndjson` override syntax can be re‑introduced.

## Help & Usage
- **Styled Help Output**: Help output uses the same styled format as normal command output for consistency:
  - Root help (`prisma-next --help`): Shows "prisma next" title with subcommands listed
  - Command help (`prisma-next db verify --help`): Shows "next <command> ➜ <description>" with options, subcommands, and docs URLs
  - Help formatters are in `packages/1-framework/3-tooling/cli/src/utils/formatters/` (multiple focused modules)
- **Routing**: explicit `--help` (and `--version`) prints to **stdout** with exit code 0; help printed as part of an error (unknown command, missing subcommand, bad flag) prints to **stderr** with the corresponding non-zero exit code. See [Output Conventions](#output-conventions-composable-cli-output) rule 8 for the rationale.
- **Fixed-Width Columns**: All two-column output (help, styled headers) uses fixed 20-character left column width for consistent alignment
- **Text Wrapping**: Right column wraps at 90 characters using `wrap-ansi` for ANSI-aware wrapping that preserves color codes
- **Default Values**: Options with default values display `default: <value>` on the following line (dimmed)
- **ANSI-Aware Formatting**: Uses `string-width` and `strip-ansi` to measure and pad text correctly, accounting for ANSI escape codes
- **Parameter Labels**: Styled headers show parameter labels with colons (e.g., `config:`, `contract:`)
- Include 1–2 copy‑pastable examples by default.
- Show aliases and defaults inline for options.
- Enable "Did you mean …" command suggestions.

## Command Suggestions
- When an unknown command is entered, the CLI suggests the closest match using Levenshtein distance.
- Suggestions appear only when the edit distance is within 40% of the input length (minimum 2).
- Up to 3 tied suggestions are shown.

## Errors
- Codes: dotted `NAMESPACE.SUBCODE` (e.g., `CONFIG.CONTRACT_MISSING`, `MIGRATION.UNFILLED_PLACEHOLDER`, `CONTRACT.MARKER_ROW_CORRUPT`, `CLI.UNKNOWN_FLAG`). The namespace *is* the category — there is no separate `domain`. Namespaces come from the closed list in [ADR 239](architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md), which also carries the crosswalk from the retired numeric `PN-DOMAIN-NNNN` codes.
- Human layout (TTY):
  - First line: `✖` concise summary + code
  - Why: one line cause
  - Next: one `→` line per entry in `nextActions`, label first, command after it
  - Where: `file:line` when applicable
  - More: hint to rerun with `-v`/`--trace`; docs link by code (`docs.prisma.io/docs/orm/next/reference/error-reference#<CODE>`)
- JSON schema (single object): `{ code, severity, summary, why, nextActions, where: { path, line }, meta, docsUrl }`. `nextActions` is always present and is `[]` when there is nothing to suggest; each entry is `{ kind: 'run-command' | 'user-choice' | 'edit-file' | 'done', label, command?, commands?, reason? }`. It replaces the freeform `fix` string — see [ADR 239](architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md#remediation-is-typed-not-prose).
- Exit code: a structured failure exits `2` (precondition; see [Exit Codes](#exit-codes)), except a user-declined prompt which exits `3`. Only an internal bug or uncaught error exits `1`. A command that **ran to its end and found problems** is not a failure: its findings are diagnostics on a completed result with a documented `4`–`99` exit code, never a thrown error.
- **Missing-input failures**: when a command fails because required flags are missing in non-interactive mode, the envelope MUST set `meta.missingFlags: string[]` listing each missing flag's long form (e.g. `["--target", "--authoring"]`) so callers can react programmatically. `nextActions` SHOULD carry a `run-command` action whose `command` is the same invocation with those flags supplied, copy-pasteable.

## Plans (Rendering)
- Summary header: target, storageHash/profileHash, op count, affected tables, estimated rows.
- Per‑op one‑liners: verb + table + key columns.
- SQL visibility: hidden by default; show with `--show-sql` or at `-v`. Truncate to 10 lines/op; override via `--max-sql-lines <n>`.
- Diffs: unified diff for DDL with `--show-diff` (auto at `--trace`).
- Annotations: inline capability gates; warnings as `⚠`.
- Timings: total + per‑step at `-v`, full timings at `--trace`.
- Params: show placeholders; never print secrets. Sample values only at `--trace` and scrubbed.
- JSON: `--json` for plan output.

## Interactivity
- Interactive by default: `init`, `migrate`, `doctor` (future).
- Non‑interactive by default: `contract emit`, `migration plan`, `migration check`, `db verify`, `db sign`, `migration status`.
- Non‑TTY/CI: never prompt; fail with a structured precondition error if input is required.
- `--interactive`/`--no-interactive` override the TTY detection.
- **Every interactive prompt MUST have a flag-driven equivalent.** A command that requires user input without a corresponding flag is broken in non-interactive mode. Adding a new prompt requires adding the matching flag in the same change.
- **Interactivity requires both stdin and stdout to be TTYs.** Commands that prompt MUST check `process.stdin.isTTY && process.stdout.isTTY`. A closed stdin (`< /dev/null`, common in CI and AI agents) is non-interactive even when stdout is a TTY. `--interactive` overrides this only when both streams are actually capable of carrying input/output.
- **`-y`/`--yes` auto-accepts non-destructive prompts only.** It does NOT consent to data loss, overwriting generated files, or any other destructive action. Destructive operations require an explicit `--force` flag (see [Destructive operation confirmation](#destructive-operation-confirmation)).

### Destructive operation confirmation

Destructive operations (drops, type changes, overwriting generated files, overwriting an existing signature marker, …) require **explicit consent via `--force`**, separate from the `-y` "skip non-destructive prompts" mechanism.

This is a deliberate divergence from clig.dev §Arguments §Confirmation. AI agents and CI scripts routinely pass `-y` to suppress prompts on long-running pipelines; conflating "skip prompts" with "consent to destruction" is a footgun the project has decided to avoid.

#### Rules

- A command that performs a destructive action MUST prompt for confirmation in interactive mode AND require `--force` to skip the prompt or to run the action non-interactively.
- The prompt MUST list the destructive operations (or describe them concretely, e.g. "this will overwrite all generated files") so the user can decline knowing what's at stake.
- In non-interactive mode (piped stdout, closed stdin, `--no-interactive`, `--json`) without `--force`: no prompt is shown; the command fails with a structured precondition error (exit code `2`) whose `nextActions` carry the same invocation with `--force` added.
- `-y`/`--yes` MUST NOT be a substitute for `--force`. A non-interactive invocation with `-y` but without `--force` against a destructive operation MUST still fail.
- The internal control API retains a programmatic equivalent (e.g. `acceptDataLoss: boolean`) for consumers that drive the planner directly; `--force` is the user-facing CLI flag.

#### Examples

- `migrate` / `db update`: when the plan includes destructive ops, prompts in interactive mode; requires `--force` to apply without a prompt or in non-interactive mode.
- `db sign`: requires `--force` to overwrite an existing marker with a different hash (already documented in [Database Commands](#database-commands)).
- `prisma-next init`: re-running `init` in a directory with a generated `prisma-next.config.ts` requires `--force`; `-y` alone is not sufficient to authorise overwriting generated files.

## Config & Environment
- Config file names: `prisma-next.config.ts|.mjs|.js` (ESM); optional CJS fallback.
- Discovery precedence: `--config <path>` > `PRISMA_NEXT_CONFIG` > nearest `prisma-next.config.*` in CWD (no upward search).
- Precedence: flags > config > defaults.
- Env policy: the CLI does not auto‑load `.env`. Apps may do so in `prisma-next.config.*` and pass values (e.g., `db.connection`).
- Contract source: defined in config; no flag override.
- Contract output directory: `--output-path <dir>` on `contract emit` sets the directory where `contract.json` and `contract.d.ts` are written. The filenames are canonical and not user-controlled. Precedence: `--output-path` flag > `output` in config > derived default (directory of the contract source file). The path is resolved relative to CWD. Extension wrappers (`defineConfig` from `@internal/mongo` and `@internal/postgres`) expose an `output?: string` option that maps directly to this config field.
- Migration directory: defined in config; no flag override.
- DB Connection: `--db=<URL>` or `config.db.connection`.

## Exit Codes

Exit codes are a **coarse classification** of command outcomes, intended for shell-level branching (`if ! prisma-next ...; then`) and CI gates. Fine-grained discrimination uses **structured error codes** — every structured error carries one, and scripts that need to react to a specific failure mode (e.g. "retry on `CLI.INIT_INVALID_FLAG_VALUE` but fail on `CLI.INIT_MISSING_FLAGS`") MUST match on the error code.

Streams are covered in [Output Conventions](#output-conventions-composable-cli-output): stdout carries the data the caller asked for (including explicit `--help` / `--version`); stderr carries decoration, warnings, errors, and help-as-decoration (e.g. usage hints printed alongside an unknown-command error).

### Reserved (CLI-wide)

These codes have a fixed meaning across every Prisma Next CLI command. Specific commands MUST NOT redefine them.

| Code | Name | Meaning |
|---|---|---|
| `0` | `OK` | The command completed and found nothing to report. |
| `1` | `INTERNAL_ERROR` | Unexpected internal failure, crash, or bug. The command did not reach a documented outcome. Reserved for "this should not have happened". |
| `2` | `PRECONDITION` | The command could not do its job: bad flags, missing required input, conflicting flags, missing prerequisite file. "Your invocation was wrong, fix it and try again." Matches commander.js and Linux convention (`misuse of shell builtin`). Never used for problems the command was asked to look for — those are findings; see [Completed with findings](#completed-with-findings). |
| `3` | `USER_ABORTED` | The user explicitly declined an interactive prompt (e.g. did not consent to a destructive overwrite). Distinct from signal-based interruption. |
| `130` | — | Interrupted by SIGINT (Ctrl+C). POSIX convention (`128 + 2`). |
| `143` | — | Terminated by SIGTERM. POSIX convention (`128 + 15`). |

### Command-specific (open-ended)

Codes `4`–`99` are available for command-specific outcome codes. Each command:

- MUST define its codes in a co-located, exported module (e.g. `src/commands/<command>/exit-codes.ts`) so consumers can import them by name rather than literal.
- MUST document each code in its `--help`, package `README.md`, or both.
- SHOULD pick names that describe an **outcome shape** (`INSTALL_FAILED`, `VERIFY_DRIFT`, `PLAN_HAS_DESTRUCTIVE_OPS`), not a specific cause.

The same numeric value MAY mean different things in different commands (e.g. `init`'s `4 = INSTALL_FAILED` is unrelated to `migration check`'s `4 = INTEGRITY_FAILED`). Exit codes are always interpreted in the context of the command that produced them; the error code disambiguates within the class.

Codes `100` and above are reserved for runtime-environment signals (POSIX `128 + N`) and MUST NOT be claimed by a command.

### Completed with findings

A command settles one of two ways: it **completes** — it ran to its end and has a result, good news or bad — or it **errors**, meaning it could not do its job. The `4`–`99` band belongs to the first case.

When a command was asked to look for problems and found some, those problems are its **result**, not an error. `migration check` finding integrity violations, `db verify` finding drift, a lint pass finding hits — each of these completes, exits its own documented code in the `4`–`99` band, and carries the individual problems as **diagnostics** in the completed envelope. A diagnostic has the same fields as an error envelope (dotted `code`, `severity`, `summary`, `why`, `nextActions`, `where`, `meta`, `docsUrl`) minus `ok`. It is pure data: never thrown, no stack.

Rules:

- A command MUST NOT throw to report a finding, and MUST NOT exit `2` for one. `2` is reserved for "I could not do my job" — `migration check` exits `2` when it cannot resolve the migration reference you named, not when the graph it checked has a dangling ref.
- A `severity: 'error'` diagnostic MUST come with a non-zero exit code, so a shell pipeline does not read a clean `0` over a reported error. Warnings alone MAY exit `0`.
- Scripts that need to know *which* problem was found MUST match on the diagnostic's dotted code. The exit code says only which class of outcome occurred.

The taxonomy behind this — errors, findings, and bugs — is [ADR 239](architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md#exit-codes).

### Promoting a command-specific code to CLI-wide

If a category of failure recurs across multiple commands and would benefit from a stable cross-command meaning, it MAY be promoted into the reserved range. Promotion is a breaking change to any command that already used that numeric code in the open range, MUST renumber every prior use, and MUST be flagged in release notes. Treat command-specific codes as conventionally stable, like any other public API.

### Why both exit codes and error codes?

Exit codes are the right tool for shell pipelines: they're a single integer, every shell understands them, and matching on them is one line of bash. They MUST stay coarse — pipelines built on exit-code matching are surprisingly common, and a small reserved core is enough for almost every shell-level decision.

Structured error codes (`CLI.INIT_MISSING_FLAGS`, `MIGRATION.UNFILLED_PLACEHOLDER`, etc.) are the precise channel — every structured error carries one. Scripts that need to discriminate between two specific failure modes that share an exit code MUST match on the error code, not the exit code.

## Removed-verb redirects

When a verb or flag is removed from the CLI surface (e.g. during a surface refactor that promotes a subcommand to top-level, or splits a flag-overloaded verb into separate verbs), the CLI MUST emit a **targeted redirect** rather than a generic "unknown command" error. The redirect:

- exits `2` (`PRECONDITION`),
- prints `Unknown command: <name>` (or `Unknown option: <flag>`) followed by a single `Use \`prisma-next <new-form>\` instead.` line on stderr, and
- does **not** execute the new verb on the user's behalf (the redirect is a diagnostic, not a backwards-compat alias).

Implementation: a small lookup table keyed by `<parent>:<subcommand>` (for verbs) or `<parent>:<subcommand>:<flag>` (for flags) is consulted during the pre-parse argv scan, before commander parses options. This keeps the redirect tied to a verb-and-flag form that is no longer registered while letting the new form's own help text and error envelopes work normally.

Concrete examples (from the migration CLI verb refactor, TML-2546). Each entry below is one row in the redirect table; the left column is the old form (no longer registered), the right column is the new top-level form:

| Removed form | Redirect target |
|---|---|
| `migration` `apply` | `migrate --to <contract>` |
| `migration` `ref` (`set` / `list` / `delete`) | `ref` (`set` / `list` / `delete`) |
| `migration status` with `--graph` | `migration graph` |
| `migration status` with the removed all/limit flags | `migration log` |
| `migration status` with `--ref X` | `migration status --to X` |

## JSON Semantics
- `--json` outputs a single JSON object for the command result to stdout regardless of TTY mode.
- When piped (`!isTTY`), no decoration is visible — only JSON data on stdout.
- **Each command's `--json` success shape MUST be defined as a schema** (arktype or equivalent) co-located with the command (e.g. `src/commands/<command>/output.ts`) and exported on the package's public surface, so downstream consumers can validate the output. The error envelope schema is shared (see [Errors](#errors)). Hand-writing JSON without a co-located schema is not allowed.
- Success and error documents on the same command SHOULD share a discriminator field (typically `ok: boolean`) so consumers can branch without inspecting the structure.

> **Future**: When streaming commands are implemented, NDJSON event streams (`--json=ndjson`) will be supported for long-running commands like `migrate`.

## Database Commands
- `db verify` (canonical):
  - Loads config + contract, connects via `--db` or `config.db.connection`.
  - Default mode checks marker presence, `storageHash`/`profileHash` equality, target match, then runs schema verification.
  - `--marker-only` performs marker-only verification.
  - `--schema-only` skips marker checks and verifies only that the live schema satisfies the contract.
  - `--strict` makes schema verification fail when the database includes elements not present in the contract.
  - `--marker-only` cannot be combined with `--schema-only` or `--strict` (exit code 2, `CLI.INVALID_VERIFY_MODE`). `--schema-only --strict` is valid.
  - Non‑interactive; single JSON with `--json`.
- `db sign` (canonical):
  - Runs the same verify phase first, then writes/updates the marker row.
  - Missing marker → insert; same hash → no‑op; different hash → never overwrite unless `--force`.
  - Options: `--force`, `--dry-run`, `--include-contract-json`, `--app-tag`, `--canonical-version`.

## Init Flow
- `prisma-next init` is the greenfield-app entry point (distinct from `prisma-next db init`, which adopts an existing database).
- Prompts: target (Postgres or Mongo, default Postgres) and schema location (default `prisma/contract.prisma`). The contract output path is derived from the schema path (replace extension with `.json`); no separate prompt.
- Detects the package manager from lockfiles (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`/`bun.lockb`, `package.json#packageManager`, falls back to npm), installs the target facade package as a dependency and `prisma-next` as a dev dependency, then runs `prisma-next contract emit` programmatically to produce `contract.json` and `contract.d.ts`.
- Scaffolds (all colocated; no `src/prisma/` split):
  - `prisma-next.config.ts` at the project root, importing `defineConfig` from the target facade (`@internal/postgres/config` or `@internal/mongo/config`). One import line, one function call.
  - `prisma/contract.prisma` (PSL) — starter schema with two related models so the user has something to query immediately.
  - `prisma/db.ts` — runtime client (e.g. `postgres<Contract>({ contractJson })`) typed against the emitted contract.
  - `prisma/contract.json` and `prisma/contract.d.ts` — emitted by the post-install `contract emit` step.
  - `prisma-next.md` — short human-facing quick reference (file locations, common commands, minimal query example).
  - `.agents/skills/prisma-next/SKILL.md` — agent skill so AI tooling in the project knows the layout and conventions.
  - `.env.example` with `DATABASE_URL=`; CLI still does not read `.env`.
  - After-init output: small celebratory header + a numbered "Next steps" list (edit the schema, run `pnpm prisma-next contract emit`, import `db` from `./prisma/db`).
- Re-init detection: if `prisma-next.config.ts` already exists, init prompts once — *"This project is already initialized. Re-initialize? This will overwrite all generated files."* — and then either overwrites everything or exits. No per-file overwrite prompts.
- `--no-install` skips dependency installation and contract emission, scaffolds the source files only, and prints the manual install + emit commands.
- Artifacts: commit `contract.json` and `contract.d.ts` to VCS by default.
- Adopter-visible dependency envelope after init: exactly two new entries in `package.json` (target facade + `prisma-next`); every other `@internal/*` package is pulled in transitively via the facade so emitted `contract.d.ts` imports resolve without `skipLibCheck` hiding broken types. The emitter additionally runs a post-emit dependency check and warns (non-blocking) when a `contract.d.ts` import is not resolvable.

## Flag Conventions
- Kebab‑case long flags; negation via `--no-<flag>` for booleans.
- Short aliases only for high‑frequency flags: `-v`, `-q`, `-y`, `-h`, `-V`.
- Numbers are plain (`--max-sql-lines 10`); durations use `--timeout-ms`.
- Global flags: `--json`, `-v/--verbose`, `--trace`, `-q/--quiet`, `--interactive`, `--no-interactive`, `-y/--yes`, `--color/--no-color`, `--config <path>`, `--db <url>`.
- Per‑command examples:
  - `contract emit`: `--contract <path>`, `--out <dir>`, `--show-sql`, `--show-diff`.
  - `migration plan`: `--out <dir>`, `--show-sql`, `--show-diff`, `--max-sql-lines <n>`, `--yes`.
  - `db sign`: `--include-contract-json`, `--app-tag`, `--canonical-version`, `--force`, `--dry-run`.

## Rationale
- Predictable, human‑oriented text with clear errors; mirror determinism and actionable messages while avoiding heavy codegen.
- Simple flags and migration UX; adopt concise help and guardrails while remaining contract‑first.
- Minimal flair; banners only for `init`.
- Prefer noun → verb command taxonomy (`db sign`, `db verify`) over colon commands for consistency.
- Follow established Node CLI best practices: short flags, colored output that respects environment, and robust help/usage.

## Loading Indicators & Spinners
- **When to use**: Show spinners for remote operations (database connections, network requests) that may take time.
- **Implementation**: Use `@clack/prompts` spinner on stderr via `TerminalUI.spinner()`. Spinners are automatically suppressed when piped (`!isTTY`), in `--quiet` mode, or with `--json` output.
- **Delay threshold**: Spinners use a 100ms delay threshold — they only appear if the operation takes longer, avoiding flicker for fast operations.
- **Output format**: Success message with elapsed time: `✔ Operation name (123ms)`. Failure: `✖ Operation name (failed)`.
- **Nested operations**: Rendered as step lines via `ui.step()` rather than separate spinners.

## Graceful Shutdown
- SIGINT (Ctrl+C) and SIGTERM are handled at CLI startup via a shared AbortController.
- First signal: aborts in-flight operations, starts a 3-second grace period for `finally` blocks to close connections.
- Second signal: force-exits immediately with code 130.
- Active spinners auto-cancel with "Interrupted" message on abort.

## Testing & Accessibility
- Width/wrapping: measure visible width, wrap long lines (use `string-width`, `wrap-ansi`, `strip-ansi`).
  - Fixed 20-character left column width for all two-column output (help, styled headers)
  - Right column wraps at 90 characters using `wrap-ansi` for ANSI-aware wrapping
  - Use `string-width` to measure display width and `strip-ansi` to remove ANSI codes when needed
- Non‑TTY: disable animations/spinners; fall back to plain lines.
- i18n readiness: avoid baked‑in ASCII art; keep text compact and translatable.
- Security: never print secrets; scrub parameters and connection strings.

## Quick Reference
- Global: `--json`, `-q`, `-v`, `--trace`, `--interactive`, `-y`, `--config <path>`, `--db <url>`.
- Commands:
  - `contract emit --contract prisma/contract.ts --out src/prisma`
  - `migration plan --name add-users-table`
  - `migration check`
  - `migrate --to production --db $DATABASE_URL`
  - `db verify --db $DATABASE_URL`
  - `db sign --db $DATABASE_URL --contract production`
  - `ref set production abc123`

## Internal Architecture
- **TerminalUI** (`src/utils/terminal-ui.ts`): Composable output abstraction. All decoration goes to stderr via `@clack/prompts`, data goes to stdout. Accepts `color` and `interactive` overrides.
- **GlobalFlags / CommonCommandOptions** (`src/utils/global-flags.ts`): Parsed flags shared by all commands. `CommonCommandOptions` is the base interface for command option types.
- **addGlobalOptions()** (`src/utils/command-helpers.ts`): Registers global flags and help formatter on any Command. All commands use this instead of inline `.option()` calls.
- **Shutdown** (`src/utils/shutdown.ts`): Global AbortController for SIGINT/SIGTERM. Exposes `shutdownSignal` for cancellable async operations.
- **Formatters** (`src/utils/formatters/`): Output formatting split into focused modules — `emit.ts`, `errors.ts`, `verify.ts`, `migrations.ts`, `styled.ts`, `help.ts`, and shared `helpers.ts`.
- **Progress Adapter** (`src/utils/progress-adapter.ts`): Converts control-api progress events into Clack spinners on stderr.

---

This guide is the single source of truth for CLI behavior. When in doubt, prefer the defaults here and keep the UX friendly, informative, and consistent with our contract‑first architecture.
