import { createHash } from 'node:crypto';
import { structuredError } from '@prisma-next/utils/structured-error';

export function defaultIndexName(tableName: string, columns: readonly string[]): string {
  return `${tableName}_${columns.join('_')}_idx`;
}

export interface WireName {
  /** The user-supplied part before the `_<8hex>` suffix. */
  readonly prefix: string;
  /** The 8-lowercase-hex content-hash suffix. */
  readonly hash: string;
}

const WIRE_NAME_PATTERN = /^(.+)_([0-9a-f]{8})$/;

/**
 * Assembles a wire name from its user-supplied prefix and its 8-hex
 * content-hash suffix. This module owns the `<prefix>_<hash>` format on both
 * sides — construction here and parsing in {@link parseWireName} — so the two
 * never drift.
 */
export function formatWireName(prefix: string, hash: string): string {
  return `${prefix}_${hash}`;
}

/**
 * Splits a wire name (`<prefix>_<8hex>`) into its prefix and content-hash
 * suffix. Returns `undefined` when the name does not follow the wire-name
 * shape (e.g. an object created outside the toolchain) — callers treat such
 * names as all-prefix. Consumed by introspection (prefix extraction) and by
 * rename pairing (same hash, different prefix).
 */
export function parseWireName(name: string): WireName | undefined {
  const match = WIRE_NAME_PATTERN.exec(name);
  const prefix = match?.[1];
  const hash = match?.[2];
  if (prefix === undefined || hash === undefined) return undefined;
  return { prefix, hash };
}

/**
 * Stabilizes an authored SQL body (index expression, partial-index predicate,
 * RLS policy predicate) for hashing: trim, and collapse runs of internal
 * whitespace to a single space.
 *
 * This is deliberately minimal. The content hash is the equivalence relation
 * for a wire-named object, and the wire name (prefix + hash) is the only
 * thing ever compared — the hash is never recomputed from an introspected
 * body, so there is no need to match the database's reprinted form. Minimal
 * normalization also protects the no-collision property: aggressive rewriting
 * (lowercasing, paren-stripping, cast-alias folding) risks collapsing two
 * distinct bodies onto one hash.
 *
 * The normalizer is a stability commitment: any change re-suffixes all wire names.
 */
export function normalizeSqlBody(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export interface IndexContentHashParts {
  readonly expression?: string;
  readonly where?: string;
  readonly columns?: readonly string[];
  readonly unique: boolean;
  readonly type?: string;
  readonly options?: Record<string, unknown>;
}

/**
 * Returns the first 8 lowercase hex characters of the SHA-256 digest over the
 * canonical content tuple for an index:
 *
 *   [normalizeSqlBody(expression), normalizeSqlBody(where), columns, unique, type, sortedOptions]
 *
 * Columns hash in authored order — column order is semantic in an index.
 * Option values are `String()`-coerced (matching the loose option equality
 * used for diffing) so a hash computed from typed contract values agrees with
 * one recomputed from introspected reloptions strings. The prefix, schema,
 * and table are excluded (they are orthogonal to index equivalence).
 *
 * The tuple order and encoding are a stability commitment with the same
 * status as the RLS tuple: any change re-suffixes every wire name.
 */
/**
 * Canonicalizes one index option VALUE to the `on`/`off` boolean spelling:
 * JS booleans and the common catalog spellings (`pg_class.reloptions`
 * stores whatever spelling the DDL used, so a live index may carry
 * `'true'`/`'false'` or `'on'`/`'off'`) all map to one form; everything
 * else via `String()` (fully specified for numbers, so no platform
 * variance). Shared by the wire-name hash tuple, the node's option
 * equality, and the DDL renderer, so an authored `{ fastupdate: true }`
 * agrees with a live index created under any boolean spelling.
 */
export function normalizeIndexOptionValue(value: unknown): string {
  if (value === true || value === 'true' || value === 'on') return 'on';
  if (value === false || value === 'false' || value === 'off') return 'off';
  return String(value);
}

export function computeIndexContentHash(parts: IndexContentHashParts): string {
  const sortedOptions = Object.entries(parts.options ?? {})
    .map(([key, value]): readonly [string, string] => [key, normalizeIndexOptionValue(value)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const tuple = JSON.stringify([
    normalizeSqlBody(parts.expression ?? ''),
    normalizeSqlBody(parts.where ?? ''),
    parts.columns ?? [],
    parts.unique,
    parts.type ?? '',
    sortedOptions,
  ]);
  return createHash('sha256').update(tuple).digest('hex').slice(0, 8);
}

/**
 * Postgres identifiers cap at 63 characters and the wire name appends a
 * 9-character `_<8hex>` suffix, so an authored prefix is bounded at 54.
 */
export const WIRE_NAME_PREFIX_MAX_LENGTH = 54;

/**
 * Rejects a wire-name prefix over {@link WIRE_NAME_PREFIX_MAX_LENGTH}.
 * `subject` opens the error message (e.g. `defineContract: policy prefix`).
 */
export function assertWireNamePrefixLength(prefix: string, subject: string): void {
  if (prefix.length > WIRE_NAME_PREFIX_MAX_LENGTH) {
    throw structuredError(
      'CONTRACT.WIRE_NAME_PREFIX_TOO_LONG',
      `${subject} "${prefix}" exceeds the ${WIRE_NAME_PREFIX_MAX_LENGTH}-character maximum (Postgres identifiers cap at 63 characters and the wire name appends a 9-character hash suffix).`,
      { meta: { prefix, maxLength: WIRE_NAME_PREFIX_MAX_LENGTH } },
    );
  }
}
