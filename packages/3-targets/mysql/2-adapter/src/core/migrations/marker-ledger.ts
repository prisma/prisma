import type { ContractMarkerRecord, LedgerEntryRecord } from '@internal/contract/types';
import { parseContractMarkerRow } from '@internal/family-sql/verify';
import { ledgerOriginFromStored } from '@internal/migration-tools/ledger-origin';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { decodeMysqlDatetime } from '@internal/target-mysql/codecs';
import { LEDGER_TABLE_NAME, MARKER_TABLE_NAME } from '@internal/target-mysql/control-tables';
import { quoteIdentifier } from '@internal/target-mysql/sql-utils';
import { structuredError } from '@internal/utils/structured-error';

type Driver = SqlControlDriverInstance<'mysql'>;

const MARKER_COLUMNS =
  'space, core_hash, profile_hash, contract_json, canonical_version, updated_at, app_tag, meta, invariants';

const LEDGER_COLUMNS =
  'space, migration_name, migration_hash, origin_core_hash, destination_core_hash, operations, created_at';

/** Whether the connection's database has the table `name`. */
export async function tableExists(driver: Driver, name: string): Promise<boolean> {
  const { rows } = await driver.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [name],
  );
  return rows.length > 0;
}

function parseJsonColumn(column: string, text: unknown): unknown {
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw structuredError(
      'CONTRACT.MARKER_ROW_CORRUPT',
      `Invalid contract marker row: ${column} is not valid JSON: ${detail}`,
      { meta: { detail }, cause: error },
    );
  }
}

/** A marker row as MySQL's text arrives, in the shape the family's marker parser reads. */
export function decodeMysqlMarkerRow(row: Readonly<Record<string, unknown>>): ContractMarkerRecord {
  const canonicalVersion = row['canonical_version'];
  const updatedAt = row['updated_at'];
  return parseContractMarkerRow({
    ...row,
    canonical_version:
      typeof canonicalVersion === 'string' ? Number(canonicalVersion) : canonicalVersion,
    updated_at: typeof updatedAt === 'string' ? decodeMysqlDatetime(updatedAt) : updatedAt,
    invariants: parseJsonColumn('invariants', row['invariants']),
  });
}

export async function readMarkerRows(
  driver: Driver,
  space: string | undefined,
): Promise<readonly Readonly<Record<string, unknown>>[] | undefined> {
  if (!(await tableExists(driver, MARKER_TABLE_NAME))) return undefined;
  const select = `SELECT ${MARKER_COLUMNS} FROM ${quoteIdentifier(MARKER_TABLE_NAME)}`;
  const { rows } =
    space === undefined
      ? await driver.query(select)
      : await driver.query(`${select} WHERE space = ?`, [space]);
  return rows;
}

function operationCount(operations: unknown): number {
  const parsed = typeof operations === 'string' ? parseOperations(operations) : operations;
  return Array.isArray(parsed) ? parsed.length : 0;
}

function parseOperations(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function text(row: Readonly<Record<string, unknown>>, column: string): string {
  const value = row[column];
  return typeof value === 'string' ? value : String(value);
}

/** The ledger's entries for `space`, or for every space, in the order they were applied. */
export async function readLedgerEntries(
  driver: Driver,
  space: string | undefined,
): Promise<readonly LedgerEntryRecord[]> {
  if (!(await tableExists(driver, LEDGER_TABLE_NAME))) return [];
  const select = `SELECT ${LEDGER_COLUMNS} FROM ${quoteIdentifier(LEDGER_TABLE_NAME)}`;
  const { rows } =
    space === undefined
      ? await driver.query(`${select} ORDER BY id`)
      : await driver.query(`${select} WHERE space = ? ORDER BY id`, [space]);
  return rows.map((row) => {
    const origin = row['origin_core_hash'];
    return {
      space: text(row, 'space'),
      migrationName: text(row, 'migration_name'),
      migrationHash: text(row, 'migration_hash'),
      from: ledgerOriginFromStored(typeof origin === 'string' ? origin : null),
      to: text(row, 'destination_core_hash'),
      appliedAt: decodeMysqlDatetime(text(row, 'created_at')),
      operationCount: operationCount(row['operations']),
    };
  });
}
