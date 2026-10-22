import type { ContractMarkerRecord, LedgerEntryRecord } from '@internal/contract/types';
import { parseMarkerRowSafely, withMarkerReadErrorHandling } from '@internal/errors/execution';
import { contractColumns, readColumnDefault } from '@internal/family-sql/control';
import type { SqlControlAdapter } from '@internal/family-sql/control-adapter';
import { codecForRef, type DataType } from '@internal/framework-components/codec';
import { APP_SPACE_ID } from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import {
  type AnyQueryAst,
  type DdlColumn,
  type DdlNode,
  isDdlNode,
  type LoweredStatement,
  type SqlExecuteRequest,
} from '@internal/sql-relational-core/ast';
import type { SqlSchemaIR } from '@internal/sql-schema-ir/types';
import type { MysqlCodecRegistry } from '@internal/target-mysql/codecs';
import {
  buildControlTableBootstrapQueries,
  buildSignMarkerBootstrapQueries,
} from '@internal/target-mysql/contract-free';
import { LEDGER_TABLE_NAME, MARKER_TABLE_NAME } from '@internal/target-mysql/control-tables';
import { MysqlCreateTable } from '@internal/target-mysql/ddl';
import { mysqlNotYetSupported, mysqlQueryNotYetSupported } from '@internal/target-mysql/errors';
import { structuredError } from '@internal/utils/structured-error';
import { renderMysqlColumnDefault, renderMysqlCreateTable } from './ddl-renderer';
import { buildMysqlSchemaIR } from './introspection';
import { readMysqlCatalog } from './introspection-queries';
import { decodeMysqlMarkerRow, readLedgerEntries, readMarkerRows } from './marker-ledger';

type Driver = SqlControlDriverInstance<'mysql'>;

function unsupportedDdl(ast: DdlNode): Error {
  return structuredError(
    'RUNTIME.DDL_UNSUPPORTED',
    `The MySQL control adapter cannot lower the DDL node "${ast.kind}".`,
    { meta: { surface: 'control-adapter', kind: ast.kind } },
  );
}

/**
 * The MySQL control adapter. It introspects the connection's database from `information_schema`, reads the marker and ledger tables, creates them, and runs work in a transaction. Writing markers and the ledger, the marker lock, and query lowering refuse with `MIGRATION.TARGET_UNSUPPORTED` until the migration slice builds them.
 */
export class MysqlControlAdapter implements SqlControlAdapter<'mysql'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'mysql' as const;

  /** `declaredDataTypes` are the stack's data types, which introspection resolves each column's reported type over. */
  constructor(
    private readonly codecRegistry: MysqlCodecRegistry,
    private readonly declaredDataTypes: readonly DataType[],
  ) {}

  bootstrapControlTableQueries(): readonly DdlNode[] {
    return buildControlTableBootstrapQueries();
  }

  bootstrapSignMarkerQueries(): readonly DdlNode[] {
    return buildSignMarkerBootstrapQueries();
  }

  lower(ast: AnyQueryAst | DdlNode): LoweredStatement {
    if (isDdlNode(ast)) {
      throw structuredError(
        'RUNTIME.DDL_UNSUPPORTED',
        'lower() cannot lower DDL: DDL default literals require inline codec encoding, which is async. Use lowerToExecuteRequest().',
        { meta: { surface: 'control-adapter' } },
      );
    }
    throw mysqlQueryNotYetSupported('Lowering queries');
  }

  async lowerToExecuteRequest(ast: AnyQueryAst | DdlNode): Promise<SqlExecuteRequest> {
    if (!isDdlNode(ast)) throw mysqlQueryNotYetSupported('Lowering queries');
    if (!(ast instanceof MysqlCreateTable)) throw unsupportedDdl(ast);
    return renderMysqlCreateTable(ast, this.codecRegistry);
  }

  async renderColumnDefault(column: DdlColumn, table: string): Promise<string> {
    if (column.default === undefined) return '';
    return renderMysqlColumnDefault(
      column.default,
      column.type,
      this.codecRegistry,
      column.codecRef,
      {
        table,
        column: column.name,
      },
    );
  }

  async readMarker(driver: Driver, space: string): Promise<ContractMarkerRecord | null> {
    return withMarkerReadErrorHandling(
      async () => {
        const rows = await readMarkerRows(driver, space);
        const [row] = rows ?? [];
        return row === undefined ? null : decodeMysqlMarkerRow(row);
      },
      { space, markerLocation: MARKER_TABLE_NAME },
    );
  }

  async readAllMarkers(driver: Driver): Promise<ReadonlyMap<string, ContractMarkerRecord>> {
    return withMarkerReadErrorHandling(
      async () => {
        const markers = new Map<string, ContractMarkerRecord>();
        for (const row of (await readMarkerRows(driver, undefined)) ?? []) {
          const space = String(row['space']);
          markers.set(
            space,
            parseMarkerRowSafely(row, () => decodeMysqlMarkerRow(row), {
              space,
              markerLocation: MARKER_TABLE_NAME,
            }),
          );
        }
        return markers;
      },
      { space: APP_SPACE_ID, markerLocation: MARKER_TABLE_NAME },
    );
  }

  async readLedger(driver: Driver, space?: string): Promise<readonly LedgerEntryRecord[]> {
    return withMarkerReadErrorHandling(() => readLedgerEntries(driver, space), {
      space: space ?? '*',
      markerLocation: LEDGER_TABLE_NAME,
    });
  }

  async insertMarker(): Promise<void> {
    throw mysqlNotYetSupported('Writing the contract marker');
  }

  async initMarker(): Promise<void> {
    throw mysqlNotYetSupported('Writing the contract marker');
  }

  async updateMarker(): Promise<boolean> {
    throw mysqlNotYetSupported('Writing the contract marker');
  }

  async writeLedgerEntry(): Promise<void> {
    throw mysqlNotYetSupported('Writing the migration ledger');
  }

  async lockMarker(): Promise<void> {
    throw mysqlNotYetSupported('Locking the contract marker');
  }

  async withTransaction<T>(driver: Driver, fn: () => Promise<T>): Promise<T> {
    await driver.query('START TRANSACTION');
    let result: T;
    try {
      result = await fn();
    } catch (error) {
      try {
        await driver.query('ROLLBACK');
      } catch (rollbackError) {
        if (error instanceof Error && error.cause === undefined) error.cause = rollbackError;
      }
      throw error;
    }
    await driver.query('COMMIT');
    return result;
  }

  async introspect(driver: Driver, contract?: unknown): Promise<SqlSchemaIR> {
    const columns = contractColumns(contract);
    return buildMysqlSchemaIR(
      await readMysqlCatalog(driver),
      this.declaredDataTypes,
      async (tableName, columnName, rawDefault) => {
        const column = columns.columnOf(undefined, tableName, columnName);
        const codec =
          column === undefined ? undefined : codecForRef(this.codecRegistry, column.codecRef);
        if (codec === undefined) return {};
        return readColumnDefault(
          codec,
          { literal: { kind: 'value', body: rawDefault }, raw: rawDefault },
          undefined,
        );
      },
    );
  }
}
