import { castAs } from '@internal/utils/casts';
import type { RuntimeConnection, RuntimeTransaction } from './sql-runtime';
import { settlementOf, wasRefusedBeforeBegin } from './transaction-state';

/**
 * Begins a transaction on a connection the transaction owns. The connection is released once the transaction has committed or rolled back, and destroyed after a failed rollback or a failed start other than a refusal before `BEGIN`. After a failed commit it stays held for the rollback that follows.
 */
export async function beginOwnedTransaction(
  connection: Pick<RuntimeConnection, 'release' | 'destroy'>,
  begin: () => Promise<RuntimeTransaction>,
): Promise<RuntimeTransaction> {
  let transaction: RuntimeTransaction;
  try {
    transaction = await begin();
  } catch (error) {
    if (wasRefusedBeforeBegin(connection)) {
      await connection.release().catch(() => undefined);
    } else {
      await connection.destroy(error).catch(() => undefined);
    }
    throw error;
  }

  let disposed = false;
  const dispose = async (destroyReason?: { readonly reason: unknown }): Promise<void> => {
    if (disposed) return;
    disposed = true;
    if (destroyReason === undefined) {
      await connection.release();
    } else {
      await connection.destroy(destroyReason.reason).catch(() => undefined);
    }
  };

  const owned: Pick<RuntimeTransaction, 'commit' | 'rollback'> = {
    async commit(): Promise<void> {
      try {
        await transaction.commit();
      } catch (error) {
        if (settlementOf(transaction)?.committed === true) await dispose();
        throw error;
      }
      await dispose();
    },
    async rollback(): Promise<void> {
      try {
        await transaction.rollback();
      } catch (error) {
        const settlement = settlementOf(transaction);
        const settled = settlement?.rolledBack === true || settlement?.committed === true;
        await dispose(settled ? undefined : { reason: error });
        throw error;
      }
      await dispose();
    },
  };
  // The owned transaction inherits the wrapped one's members, including its internal symbol members such as its settlement.
  return Object.assign(castAs<RuntimeTransaction>(Object.create(transaction)), owned);
}
