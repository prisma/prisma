import type { Result } from '@internal/utils/result';
import { notOk, ok } from '@internal/utils/result';
import { validateRefName } from '../refs';
import type { MigrationRef, RefResolutionContext, RefResolutionError } from './types';
import { findEdgeByDirName, isFullHash, isHexPrefix } from './types';

/**
 * Resolve a user-supplied string to a migration using the migration-reference
 * grammar.
 *
 * Accepted forms:
 * - Migration directory name (e.g. `20260101-add-users`)
 * - Migration hash (full or 6+ hex prefix)
 *
 * Wrong-grammar diagnostics are produced when the input matches a
 * contract-grammar form (ref name, `<dir>^`, contract-only hash) so the
 * user gets a targeted hint rather than a generic "not found".
 */
export function parseMigrationRef(
  input: string,
  ctx: RefResolutionContext,
): Result<MigrationRef, RefResolutionError> {
  if (!input) {
    return notOk({ kind: 'invalid-format', input, reason: 'Reference cannot be empty' });
  }

  if (input.endsWith('^')) {
    return notOk({
      kind: 'wrong-grammar',
      input,
      expectedGrammar: 'migration',
      message: '`^` syntax addresses contracts, not migrations',
      fix: 'Pass the migration directory name without `^`, or use a contract-accepting flag like `--to` or `--from`.',
    });
  }

  if (validateRefName(input) && Object.hasOwn(ctx.refs, input)) {
    return notOk({
      kind: 'wrong-grammar',
      input,
      expectedGrammar: 'migration',
      message: `"${input}" is a ref name, not a migration`,
      fix: 'Refs point at contracts, not migrations. Use a migration directory name or migration hash.',
    });
  }

  const edge = findEdgeByDirName(ctx.graph, input);
  if (edge) {
    return ok({
      dirName: edge.dirName,
      migrationHash: edge.migrationHash,
      from: edge.from,
      to: edge.to,
      provenance: { kind: 'dir-name', dirName: input },
    });
  }

  if (isFullHash(input)) {
    const migEdge = ctx.graph.migrationByHash.get(input);
    if (migEdge) {
      return ok({
        dirName: migEdge.dirName,
        migrationHash: migEdge.migrationHash,
        from: migEdge.from,
        to: migEdge.to,
        provenance: { kind: 'hash', input },
      });
    }
    if (ctx.graph.nodes.has(input)) {
      return notOk({
        kind: 'wrong-grammar',
        input,
        expectedGrammar: 'migration',
        message: 'Hash matched a contract but not a migration',
        fix: 'Use a contract-accepting flag like `--to` or `--from` to reference contracts by hash. Pass `migration show <dir>` for a specific migration.',
      });
    }
    return notOk({ kind: 'not-found', input, grammar: 'migration' });
  }

  if (isHexPrefix(input)) {
    const migMatches = [...ctx.graph.migrationByHash.entries()].filter(([hash]) =>
      hash.startsWith(input),
    );

    const [firstMigMatch] = migMatches;
    if (migMatches.length === 1 && firstMigMatch !== undefined) {
      const [, matchedEdge] = firstMigMatch;
      return ok({
        dirName: matchedEdge.dirName,
        migrationHash: matchedEdge.migrationHash,
        from: matchedEdge.from,
        to: matchedEdge.to,
        provenance: { kind: 'hash', input },
      });
    }

    if (migMatches.length > 1) {
      return notOk({
        kind: 'ambiguous',
        input,
        candidates: migMatches.map(([hash]) => hash),
        grammar: 'migration',
      });
    }

    const contractMatches = [...ctx.graph.nodes].filter((n) => n.startsWith(input));
    if (contractMatches.length > 0) {
      return notOk({
        kind: 'wrong-grammar',
        input,
        expectedGrammar: 'migration',
        message: 'Hash matched a contract but not a migration',
        fix: 'Use a contract-accepting flag like `--to` or `--from` to reference contracts by hash. Pass `migration show <dir>` for a specific migration.',
      });
    }
  }

  return notOk({ kind: 'not-found', input, grammar: 'migration' });
}
