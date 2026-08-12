import type { Brand, StorageHashBase } from '@internal/contract/types';
import type { ErrorMessage } from './type-errors';

/**
 * An object representing a reference to a table in the database.
 *
 * @template TName The name of the table. `string` is all tables, a union of string literals is a set of specific tables, a single string literal is a specific table.
 * @template THash The contract storage hash belonging to the database this table is in.
 */
export type TableReference<
  TName extends string = string,
  THash extends StorageHashBase<string> = StorageHashBase<string>,
> = {
  readonly '~name': TName;
} & Brand<
  '[info] this table reference belongs to the contract with the following storage hash:',
  THash
>;

/**
 * An error type indicating that the provided table reference is out of the contract's scope.
 * To be used in reference creators, e.g. `createRef()`.
 *
 * @template TMessage The error message.
 */
export type TableReferenceOutOfContractError<TMessage extends ErrorMessage> = Brand<TMessage>;

/**
 * An error type indicating that the provided table reference is too wide.
 * To be used as a `never` alternative in conditional types.
 *
 * @template TMessage The error message.
 */
export type TableReferenceTooWideError<TMessage extends ErrorMessage> = Brand<TMessage>;
