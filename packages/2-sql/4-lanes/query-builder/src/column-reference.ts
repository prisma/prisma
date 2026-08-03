import type { Brand, StorageHashBase } from '@internal/contract/types';
import type { ErrorMessage } from './type-errors';

/**
 * An object representing a reference to a column in a table in the database.
 *
 * @template TColumnName The name of the column.
 * @template TTableName The name of the table this column belongs to.
 * @template THash The contract storage hash belonging to the database this column is in.
 */
export type ColumnReference<
  TColumnName extends string = string,
  TTableName extends string = string,
  THash extends StorageHashBase<string> = StorageHashBase<string>,
> = {
  readonly '~name': TColumnName;
  readonly '~table': TTableName;
} & Brand<
  '[info] this column reference belongs to the following table reference:',
  `${TTableName}@${THash}`
>;

/**
 * An error type indicating that the provided column reference is out of the contract's scope.
 * To be used in reference creators, e.g. `createRef()`.
 *
 * @template TMessage The error message.
 */
export type ColumnReferenceOutOfContractError<TMessage extends ErrorMessage> = Brand<TMessage>;

/**
 * A type representing a reference to all columns in the current query context.
 */
export type Asterisk = {
  readonly '~name': '*';
  readonly '~table': null;
} & Brand<'[info] referencing all columns in the current query context'>;

/**
 * A type representing a reference to all columns in a specific table.
 *
 * @template TTableName The name of the table whose columns are being referenced.
 * @template THash The contract storage hash belonging to the database this column is in.
 */
export type TableAsterisk<
  TTableName extends string = string,
  THash extends StorageHashBase<string> = StorageHashBase<string>,
> = {
  readonly '~name': '*';
  readonly '~table': TTableName;
} & Brand<
  '[info] referencing all columns that belong to the following table reference:',
  `${TTableName}@${THash}`
>;
