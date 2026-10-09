import type { MigrationPlanOperation } from '@internal/framework-components/control';

function collectionOfStep(step: unknown): string | undefined {
  if (typeof step !== 'object' || step === null) return undefined;
  const command: unknown = Reflect.get(step, 'command');
  if (typeof command !== 'object' || command === null) return undefined;
  const collection: unknown = Reflect.get(command, 'collection');
  return typeof collection === 'string' ? collection : undefined;
}

const FIELD_REWRITE_OPERATORS = ['$unset', '$rename'] as const;

function rewrittenFieldOf(command: object): string | undefined {
  const update: unknown = Reflect.get(command, 'update');
  if (typeof update !== 'object' || update === null) return undefined;
  for (const operator of FIELD_REWRITE_OPERATORS) {
    const fields: unknown = Reflect.get(update, operator);
    if (typeof fields === 'object' && fields !== null) return Object.keys(fields)[0];
  }
  return undefined;
}

function storageNameOfRunStep(step: unknown): string | undefined {
  if (typeof step !== 'object' || step === null) return undefined;
  const command: unknown = Reflect.get(step, 'command');
  if (typeof command !== 'object' || command === null) return undefined;
  const collection: unknown = Reflect.get(command, 'collection');
  if (typeof collection !== 'string') return undefined;
  const field = rewrittenFieldOf(command);
  return field === undefined ? collection : `${collection}.${field}`;
}

/**
 * The collection an operation's command names, as the database knows it: the name the Mongo
 * planner gives a dropped collection. A field rewrite is named `<collection>.<field>`. An operation
 * whose commands name no collection is named by its id.
 */
export function mongoStorageNameOf(operation: MigrationPlanOperation): string {
  const execute: unknown = Reflect.get(operation, 'execute');
  const steps: readonly unknown[] = Array.isArray(execute) ? execute : [];
  for (const step of steps) {
    const collection = collectionOfStep(step);
    if (collection !== undefined) return collection;
  }
  const run: unknown = Reflect.get(operation, 'run');
  for (const step of Array.isArray(run) ? run : []) {
    const name = storageNameOfRunStep(step);
    if (name !== undefined) return name;
  }
  return operation.id;
}
