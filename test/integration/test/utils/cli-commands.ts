/**
 * The authoring surfaces the journey suites drive in-process.
 *
 * These come from the workspace packages, and they are re-exported here rather
 * than imported directly by each suite so the whole of `test/integration` runs
 * exactly one copy of the CLI. A suite that reached for the published
 * `@prisma/orm-toolchain` instead would load a second copy alongside this one —
 * two command registries, two sets of classes, two of every value compared by
 * reference — which is the failure `scripts/lint-single-import-root.mjs`
 * exists to catch.
 *
 * Commands themselves are no longer factories: the commander shell was
 * deleted, and every suite runs invocations through the engine harness via
 * `runOnEngine` in `./cli-test-helpers` — one copy of the CLI for the same
 * reason, the `ormCommandFamily` from the workspace `@internal/cli`.
 *
 * A journey's *generated project* is a different matter: the config and
 * migration files these suites write name published packages, because that is
 * what a user's project installs, and the CLI loads them in a project of their
 * own.
 */

export { format } from '@internal/psl-parser/format';
export { printPsl } from '@internal/psl-printer';
// The hashing a journey re-computes to check what the CLI wrote. Same reason as
// the commands above: one copy, so the hash the test computes is the hash the
// command computed.
export { computeIndexContentHash, normalizeSqlBody } from '@internal/sql-schema-ir/naming';
export { computeContentHash } from '@internal/target-postgres/rls-canonicalize';
