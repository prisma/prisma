import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { SelectBuilder } from './select-builder';
import type { UnboundTables } from './selection';
import type { TableReference, TableReferenceTooWideError } from './table-reference';
import type { PreviousFunctionReceivedBadInputError } from './type-errors';

/**
 * The root of all builder.
 *
 * @template TContract The contract that describes the database.
 */
export class Root<TContract extends Contract<SqlStorage>> {
  readonly #contract: TContract;

  constructor(contract: TContract) {
    this.#contract = contract;
  }

  /**
   * SQL's `from` clause, where all `select` queries actually start from.
   *
   * @param table The table to select from.
   */
  from(
    table: TableReference<never>,
  ): PreviousFunctionReceivedBadInputError<'[error] invalid table reference in previous `root.from()` call will probably cause runtime errors'>;
  /**
   * @template TName The name of the table to select from.
   */
  from<TName extends string>(
    table: string extends TName
      ? TableReferenceTooWideError<'[error] `root.from()` call received a table reference without a specific table name'>
      : TableReference<TName, TContract['storage']['storageHash']>,
  ): TName extends string
    ? SelectBuilder<TContract, Pick<UnboundTables<TContract>, TName>>
    : PreviousFunctionReceivedBadInputError<'[error] invalid table reference in previous `root.from()` call will probably cause runtime errors'>;
  from(
    table: TableReferenceTooWideError<'[error] `root.from()` call received a table reference without a specific table name'>,
  ): PreviousFunctionReceivedBadInputError<'[error] invalid table reference in previous `root.from()` call will probably cause runtime errors'>;
  /**
   * @internal
   */
  from(_table: unknown): unknown {
    // TODO: use runtime table reference value to do something "AST"-related.
    return new SelectBuilder(this.#contract);
  }
}

/**
 * Creates a new `Root` instance.
 */
export function createRoot(
  contract: never,
): PreviousFunctionReceivedBadInputError<'[error] root creation will likely fail at runtime given the passed contract is not valid or verified'>;
/**
 * @template TContract The contract that describes the database.
 */
export function createRoot<TContract extends Contract<SqlStorage>>(
  contract: TContract,
): Root<TContract>;
/**
 * @internal
 */
export function createRoot(contract: unknown): unknown {
  // Blind cast: the public overloads above (`createRoot(TContract)`)
  // statically constrain `contract` to `Contract<SqlStorage>` —
  // this internal `unknown` overload exists only to give the
  // implementation a single body. Any caller that reaches the
  // `unknown` form has already been narrowed by the matching
  // overload at compile time.
  return new Root(contract as unknown as Contract<SqlStorage>);
}
