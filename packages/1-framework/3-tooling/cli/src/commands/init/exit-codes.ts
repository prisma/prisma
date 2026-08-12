/**
 * Stable exit codes for the `init` command.
 *
 * These are part of the command's public contract. AI agents and CI scripts
 * branch on them (FR1.6), so the values must remain stable across versions.
 *
 * Codes 0–3 are the CLI-wide reserved values per the [CLI Style Guide
 * Exit Codes section](../../../../../../../docs/CLI%20Style%20Guide.md#exit-codes):
 * `OK = 0`, `INTERNAL_ERROR = 1`, `PRECONDITION = 2`, `USER_ABORTED = 3`.
 * Codes 4 and 5 are command-specific outcomes for `init`'s two fallible
 * side effects (install + emit). Documented in `--help` via
 * `setCommandDescriptions` in `./index.ts`.
 */

export const INIT_EXIT_OK = 0;

/**
 * Anything we did not anticipate — a bug in prisma-next, not something
 * the caller did wrong. Includes the structured error code `5009`
 * (invalid output document) and any unrecognised internal error code,
 * so callers can distinguish "tool is broken" from "your invocation
 * was wrong" (`PRECONDITION = 2`). Maps to the generic "RUN" error
 * domain.
 */
export const INIT_EXIT_INTERNAL_ERROR = 1;

/**
 * Preconditions not met. The caller asked for something we cannot do
 * without more input or a different environment. Examples:
 *   - non-interactive mode without enough flags to proceed
 *   - re-init without `--force` in non-interactive mode
 *   - malformed `package.json` / `tsconfig.json`
 */
export const INIT_EXIT_PRECONDITION = 2;

/**
 * The user actively aborted an interactive prompt (Ctrl-C, declined the
 * re-init confirmation, etc.). Distinct from PRECONDITION because the user
 * was given the choice and made it; no diagnostic is needed.
 */
export const INIT_EXIT_USER_ABORTED = 3;

/**
 * Dependency installation step failed without a recoverable fallback.
 * `init` automatically falls back from `pnpm` to `npm` on a recognised
 * workspace/catalog leak (FR7.2); this code is returned only when the
 * fallback also fails, or when the package manager is not pnpm and the
 * single attempt failed. Files written before the install step (config,
 * schema, db client, etc.) remain on disk so the user can fix the
 * environment and re-run; the error envelope's `meta.filesWritten` lists
 * them.
 */
export const INIT_EXIT_INSTALL_FAILED = 4;

/**
 * Contract emit step failed after a successful install. Files written
 * before emit (including any installed dependencies) are still on disk;
 * the user can fix the underlying issue (typically a contract syntax
 * error or a missing extension pack) and re-run `prisma-next contract
 * emit` manually.
 */
export const INIT_EXIT_EMIT_FAILED = 5;

/**
 * The project-level Prisma Next skills install (`npx skills add
 * prisma/prisma#v<version>`) failed after a successful dependency
 * install + emit. The scaffolded project files remain on disk; the
 * user can fix the underlying issue (network, registry reachability,
 * `npx skills` not on PATH) and run the install manually, or re-run
 * `init` with `--no-skill` to skip it.
 */
export const INIT_EXIT_SKILL_INSTALL_FAILED = 6;
