import type {
  ControlMutationDefaultEntry,
  LoweredDefaultResult,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/control';
import { timestampNowControlDescriptor } from '@internal/framework-components/control';
import { builtinGeneratorRegistryMetadata } from '@internal/ids';
import type { FuncCallSig } from '@internal/psl-parser';
import { postgresNowGeneratorControlDescriptors } from '@internal/target-postgres/control';

function databaseFunction(expression: string): LoweredDefaultResult {
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression } } };
}

const nowSig: FuncCallSig = {
  documentation: 'Uses the current database timestamp as the default value.',
};
const autoincrementSig: FuncCallSig = {
  documentation: 'Generates an increasing integer value in the database.',
};

const postgresDefaultFunctionRegistryEntries: ReadonlyArray<
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

export function createPostgresDefaultFunctionRegistry(): ReadonlyMap<
  string,
  ControlMutationDefaultEntry
> {
  return new Map(postgresDefaultFunctionRegistryEntries);
}

export function createPostgresMutationDefaultGeneratorDescriptors(): readonly MutationDefaultGeneratorDescriptor[] {
  return [
    ...builtinGeneratorRegistryMetadata,
    timestampNowControlDescriptor(),
    ...postgresNowGeneratorControlDescriptors(),
  ];
}
