import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import type {
  Asterisk,
  ColumnReference,
  ColumnReferenceOutOfContractError,
  TableAsterisk,
} from './column-reference';
import type { UnboundTables } from './selection';
import type { TableReference, TableReferenceOutOfContractError } from './table-reference';

/**
 * A fluent API representing references to tables and columns in a SQL contract.
 *
 * @template TContract The contract that describes the database.
 */
export type Ref<TContract extends Contract<SqlStorage>> = {
  readonly [TableName in keyof UnboundTables<TContract> & string]: TableReference<
    TableName,
    TContract['storage']['storageHash']
  > & {
    readonly [ColumnName in Exclude<
      keyof UnboundTables<TContract>[TableName]['columns'],
      keyof TableReference
    > &
      string]: ColumnReference<ColumnName, TableName, TContract['storage']['storageHash']>;
  } & {
    readonly ['*']: TableAsterisk<TableName, TContract['storage']['storageHash']>;
  } & Record<
      PropertyKey,
      ColumnReferenceOutOfContractError<`[error] reference to a non-existing column in the '${TableName}' table`>
    >;
} & {
  readonly ['*']: Asterisk;
} & Record<
    PropertyKey,
    TableReferenceOutOfContractError<`[error] reference to a non-existing table in the contract`>
  >;

/**
 * Creates a reference object for the given SQL contract.
 *
 * @template TContract The contract that describes the database.
 */
export function createRef<TContract extends Contract<SqlStorage>>(
  _contract: TContract,
): Ref<TContract> {
  return new Proxy({} as Ref<TContract>, {
    get(_target, tableName) {
      if (tableName === '*') {
        return Object.freeze({
          '~name': tableName,
          '~table': null,
        });
      }

      return new Proxy(
        {},
        {
          get(_target, columnName) {
            if (columnName === '~name') {
              return tableName;
            }

            return Object.freeze({
              '~name': columnName,
              '~table': tableName,
            });
          },
        },
      );
    },
  });
}
