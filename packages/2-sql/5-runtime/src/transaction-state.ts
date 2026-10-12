/**
 * What the database did with a transaction the runtime wrapped. `withTransaction` and the ORM read it to tell a failed `COMMIT` or `ROLLBACK` from an `activityEnded` hook that threw after the database had already settled the transaction.
 */
export const transactionSettlement = Symbol('transactionSettlement');

export interface TransactionSettlement {
  /** The driver's `COMMIT` resolved. */
  readonly committed: boolean;
  /** The driver's `ROLLBACK` resolved. */
  readonly rolledBack: boolean;
}

export interface SettledTransactionTarget {
  readonly [transactionSettlement]: TransactionSettlement;
}

export function settlementOf(transaction: object): TransactionSettlement | undefined {
  return isSettledTransactionTarget(transaction) ? transaction[transactionSettlement] : undefined;
}

function isSettledTransactionTarget(value: object): value is SettledTransactionTarget {
  return transactionSettlement in value;
}

/**
 * How the last transaction start on a connection the runtime made went. `withTransaction` releases the connection after a start the `activityStarted` hooks refused before any `BEGIN` was sent, and destroys it after any other start failure.
 */
export const transactionStart = Symbol('transactionStart');

export interface TransactionStart {
  refusedBeforeBegin: boolean;
}

export interface TransactionStartTarget {
  readonly [transactionStart]: TransactionStart;
}

export function createTransactionStart(): TransactionStart {
  return { refusedBeforeBegin: false };
}

export function wasRefusedBeforeBegin(connection: object): boolean {
  return isTransactionStartTarget(connection) && connection[transactionStart].refusedBeforeBegin;
}

function isTransactionStartTarget(value: object): value is TransactionStartTarget {
  return transactionStart in value;
}
