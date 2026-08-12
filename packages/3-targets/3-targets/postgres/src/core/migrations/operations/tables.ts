import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import { tableExistsAst } from '../../../contract-free/checks';
import { qualifyTableName } from '../planner-sql-checks';
import { type Op, step, targetDetails } from './shared';

export async function dropTable(
  schemaName: string,
  tableName: string,
  lowerer: ExecuteRequestLowerer,
): Promise<Op> {
  const qualified = qualifyTableName(schemaName, tableName);
  const checks = tableExistsAst(schemaName, tableName);
  const present = await lowerer.lowerToExecuteRequest(checks.tablePresent());
  const absent = await lowerer.lowerToExecuteRequest(checks.tableAbsent());
  return {
    id: `dropTable.${tableName}`,
    label: `Drop table "${tableName}"`,
    operationClass: 'destructive',
    target: targetDetails('table', tableName, schemaName),
    precheck: [step(`ensure table "${tableName}" exists`, present.sql, present.params)],
    execute: [step(`drop table "${tableName}"`, `DROP TABLE ${qualified}`)],
    postcheck: [step(`verify table "${tableName}" does not exist`, absent.sql, absent.params)],
  };
}
