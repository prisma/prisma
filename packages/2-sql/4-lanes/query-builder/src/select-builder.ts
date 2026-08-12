import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { Asterisk, TableAsterisk } from './column-reference';
import type { Selection, TableToSelection, UnboundTables } from './selection';
import type { ExactlyOneProperty, IsNever, MergeObjects, Simplify } from './type-atoms';
import type { PreviousFunctionReceivedBadInputError } from './type-errors';

/**
 * A builder for SQL `select` queries.
 *
 * @template TContract The contract that describes the database.
 * @template TTables The tables involved in the current `select` query.
 * @template TSelection The current selection of the `select` query.
 */
export class SelectBuilder<
  TContract extends Contract<SqlStorage>,
  TTables extends UnboundTables<Contract<SqlStorage>>,
  TSelection extends Selection = never,
> {
  // @ts-expect-error
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: will be used soon.
  readonly #contract: TContract;

  constructor(contract: TContract) {
    this.#contract = contract;
  }

  select(
    asterisk: Asterisk,
  ): ExactlyOneProperty<TTables> extends true
    ? SelectBuilder<
        TContract,
        TTables,
        MergeObjects<TSelection, TableToSelection<TContract, keyof TTables & string>>
      >
    : PreviousFunctionReceivedBadInputError<'[error] selecting all columns via `*` results in ambiguity when multiple tables are involved in the query'>;
  select<TTableName extends keyof TTables & string>(
    asterisk: TableAsterisk<TTableName, TContract['storage']['storageHash']>,
  ): SelectBuilder<
    TContract,
    TTables,
    MergeObjects<TSelection, TableToSelection<TContract, TTableName>>
  >;
  select(
    arg: never,
  ): PreviousFunctionReceivedBadInputError<'[error] invalid input in previous `select()` call'>;
  select(..._args: unknown[]): unknown {
    // TODO: do runtime stuff.
    return this;
  }

  // TODO: the return type here is not the real one we'll use eventually.
  // I'm using something to test the selection stuff.
  build(): IsNever<TSelection> extends true
    ? // TODO: either split to two builders or provide a type-level error here.
      never
    : Simplify<TSelection> {
    // TODO: do runtime stuff.
    return {} as never;
  }
}
