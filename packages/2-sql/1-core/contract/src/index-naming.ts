import {
  assertWireNamePrefixLength,
  computeIndexContentHash,
  defaultIndexName,
  formatWireName,
} from '@prisma-next/sql-schema-ir/naming';
import { InternalError } from '@prisma-next/utils/internal-error';
import type { IndexInput } from './ir/sql-index';

/**
 * An index as authored, before naming: `map` is an exact physical name
 * (adopted verbatim, PSL `map:`); `name` is a managed wire-name prefix
 * (TS `name:`). With neither, the managed prefix defaults to
 * `defaultIndexName(table, columns)`.
 */
export interface AuthoredIndexInput {
  readonly columns: readonly string[];
  readonly map: string | undefined;
  readonly name: string | undefined;
  readonly type: string | undefined;
  readonly options: Record<string, unknown> | undefined;
}

/**
 * Lowers an authored index into the name-identified entity `contract.json`
 * persists: exact mode adopts `map` verbatim (no prefix, no hash); managed
 * mode appends the content-hash suffix to the authored or default prefix.
 * `unique` always lowers `false` — no authoring surface sets it yet.
 */
export function lowerAuthoredIndex(tableName: string, authored: AuthoredIndexInput): IndexInput {
  if (authored.map !== undefined) {
    if (authored.name !== undefined) {
      throw new InternalError(
        `Index "${authored.map}" on table "${tableName}": map and name are mutually exclusive.`,
      );
    }
    return {
      name: authored.map,
      prefix: undefined,
      columns: authored.columns,
      where: undefined,
      unique: false,
      type: authored.type,
      options: authored.options,
    };
  }

  const prefix = authored.name ?? defaultIndexName(tableName, authored.columns);
  assertWireNamePrefixLength(prefix, 'index prefix');
  const hash = computeIndexContentHash({
    columns: authored.columns,
    unique: false,
    ...(authored.type !== undefined && { type: authored.type }),
    ...(authored.options !== undefined && { options: authored.options }),
  });
  return {
    name: formatWireName(prefix, hash),
    prefix,
    columns: authored.columns,
    where: undefined,
    unique: false,
    type: authored.type,
    options: authored.options,
  };
}
