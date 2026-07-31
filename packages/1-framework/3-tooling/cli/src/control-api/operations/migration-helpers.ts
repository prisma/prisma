import type { MigrationPlanOperation } from '@internal/framework-components/control';
import type { ControlActionName, OnControlProgress } from '../types';

/**
 * Strips operation objects to their public shape (id, label, operationClass).
 * Used at the API boundary to avoid leaking internal fields (precheck, execute, postcheck, etc.).
 */
export function stripOperations(
  operations: readonly MigrationPlanOperation[],
): ReadonlyArray<{ readonly id: string; readonly label: string; readonly operationClass: string }> {
  return operations.map((op) => ({
    id: op.id,
    label: op.label,
    operationClass: op.operationClass,
  }));
}

/**
 * Creates per-operation progress callbacks for the runner.
 * Returns undefined when no onProgress callback is provided.
 */
export function createOperationCallbacks(
  onProgress: OnControlProgress | undefined,
  action: ControlActionName,
  parentSpanId: string,
) {
  if (!onProgress) {
    return undefined;
  }
  return {
    onOperationStart: (op: MigrationPlanOperation) => {
      onProgress({
        action,
        kind: 'spanStart',
        spanId: `operation:${op.id}`,
        parentSpanId,
        label: op.label,
      });
    },
    onOperationComplete: (op: MigrationPlanOperation) => {
      onProgress({
        action,
        kind: 'spanEnd',
        spanId: `operation:${op.id}`,
        outcome: 'ok',
      });
    },
  };
}
