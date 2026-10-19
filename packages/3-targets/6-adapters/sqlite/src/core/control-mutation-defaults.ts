import type {
  ControlMutationDefaultEntry,
  LoweredDefaultResult,
} from '@internal/framework-components/control';
import type { FuncCallSig } from '@internal/psl-parser';

function databaseFunction(expression: string): LoweredDefaultResult {
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression } } };
}

const nowSig: FuncCallSig = {
  documentation: 'Uses the current database timestamp as the default value.',
};
const autoincrementSig: FuncCallSig = {
  documentation: 'Generates an increasing integer value in the database.',
};

const sqliteDefaultFunctionRegistryEntries: ReadonlyArray<
  readonly [string, ControlMutationDefaultEntry]
> = [
  [
    'autoincrement',
    {
      signature: autoincrementSig,
      lower: () => databaseFunction('autoincrement()'),
      usageSignatures: ['autoincrement()'],
    },
  ],
  [
    'now',
    { signature: nowSig, lower: () => databaseFunction('now()'), usageSignatures: ['now()'] },
  ],
];

export function createSqliteDefaultFunctionRegistry(): ReadonlyMap<
  string,
  ControlMutationDefaultEntry
> {
  return new Map(sqliteDefaultFunctionRegistryEntries);
}
