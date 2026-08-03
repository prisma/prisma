import { createHash } from 'node:crypto';
import { ContractValidationError } from '@internal/contract/contract-validation-error';
import { structuredError } from '@internal/utils/structured-error';

export function defaultIndexName(tableName: string, columns: readonly string[]): string {
  return `${tableName}_${columns.join('_')}_idx`;
}

export interface WireName {
  /** The user-supplied part before the `_<8hex>` suffix. */
  readonly prefix: string;
  /** The 8-lowercase-hex content-hash suffix. */
  readonly hash: string;
}

/**
 * Where a name-identified object's name comes from: `wire` means the
 * toolchain derives it as `formatWireName(prefix, hash)`; `exact` means the
 * author owns it verbatim. Because the wire arm carries only the prefix
 * and the hash, a name that disagrees with its prefix is unrepresentable.
 *
 * Storage and JSON stay flat (`name` plus an optional `prefix`);
 * {@link parseNaming} is the way back in.
 */
export type SqlObjectNaming =
  | { readonly kind: 'exact'; readonly name: string }
  | ({ readonly kind: 'wire' } & WireName);

/** The flat name the union describes. Inverse of {@link namingOf}. */
export function nameOf(naming: SqlObjectNaming): string {
  return naming.kind === 'wire' ? formatWireName(naming.prefix, naming.hash) : naming.name;
}

/**
 * The naming a name-identified node was built with, read back off the flat
 * pair it stores. Inverse of {@link nameOf}, and total for that
 * reason: the constructor derived `name` from the union, so the two agree.
 * Flat data arriving from outside the process goes through
 * {@link parseNaming} instead.
 */
export function namingOf(name: string, prefix: string | undefined): SqlObjectNaming {
  if (prefix === undefined) return { kind: 'exact', name };
  return { kind: 'wire', prefix, hash: name.slice(prefix.length + 1) };
}

/**
 * Reads naming out of flat stored data — deserialized contract JSON and the
 * literals a user may hand-edit, the one place a name and a prefix can still
 * disagree. Throws when a declared prefix does not parse back out of the name.
 */
export function parseNaming(name: string, prefix: string | undefined): SqlObjectNaming {
  if (prefix === undefined) return { kind: 'exact', name };
  const parsed = parseWireName(name);
  if (parsed === undefined || parsed.prefix !== prefix) {
    throw new ContractValidationError(
      `"${name}": prefix "${prefix}" does not match the wire name (expected "${formatWireName(prefix, '<8hex>')}").`,
      'storage',
    );
  }
  return { kind: 'wire', prefix: parsed.prefix, hash: parsed.hash };
}

/**
 * The naming an object read out of a live catalog has: a wire-shaped name
 * gets the wire arm so the rename pass can pair it by prefix, and every
 * other name is exact.
 *
 * The wire answer is a claim about the name's SHAPE only — the hash is
 * deliberately not recomputed from the object's content here. Nothing
 * downstream reads it as more than that: the differ always asks the
 * contract-derived side to choose the comparison, so a shape-only wire
 * claim on the introspected side never suppresses a body comparison, and
 * `contract infer` recomputes the hash independently before it will emit an
 * index as wire-named.
 */
export function namingOfLiveName(name: string): SqlObjectNaming {
  const wire = parseWireName(name);
  return wire === undefined
    ? { kind: 'exact', name }
    : { kind: 'wire', prefix: wire.prefix, hash: wire.hash };
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
