import type { SqlMigrationPlanOperation } from '@internal/family-sql/control';
import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import type { MigrationPlanOperation, OpFactoryCall } from '@internal/framework-components/control';
import { blindCast } from '@internal/utils/casts';
import { isThenable } from '@internal/utils/promise';
import { sqliteError } from '../errors';
import type { SqlitePlanTargetDetails } from './planner-target-details';

type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;

function assertSqliteOp(op: MigrationPlanOperation, callFactoryName: string): asserts op is Op {
  const targetId = blindCast<
    { target?: { id?: string } },
    'op.target is present on concrete SqlMigrationPlanOperation but absent on the framework MigrationPlanOperation base'
  >(op).target?.id;
  if (targetId !== 'sqlite') {
    throw sqliteError(
      'MIGRATION.TARGET_MISMATCH',
      `renderOps: expected sqlite op but got target.id="${String(targetId)}" for op.id="${op.id}" (factoryName="${callFactoryName}"). An OpFactoryCall produced an op for a different target on the sqlite planner path; check the call's target binding.`,
      { meta: { opId: op.id, targetId: String(targetId), factoryName: callFactoryName } },
    );
  }
}

export function renderOps(
  calls: readonly OpFactoryCall[],
  lowerer?: ExecuteRequestLowerer,
): (Op | Promise<Op>)[] {
  return calls.map((c) => {
    const opOrPromise = blindCast<
      { toOp(lowerer?: ExecuteRequestLowerer): Op | Promise<Op> },
      'SQLite OpFactoryCall.toOp accepts an optional ExecuteRequestLowerer; the framework interface omits it because not all targets need a lowerer — the SQLite target overrides with this extended signature'
    >(c).toOp(lowerer);
    if (isThenable(opOrPromise)) {
      return opOrPromise.then((op) => {
        assertSqliteOp(op, c.factoryName);
        return op;
      });
    }
    assertSqliteOp(opOrPromise, c.factoryName);
    return opOrPromise;
  });
}
