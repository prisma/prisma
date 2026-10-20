import type { ExecutionMutationDefaultValue } from '@internal/contract/types';
import { sqlDefaultFunctionSignatures } from '@internal/family-sql/control';
import type {
  ControlMutationDefaultEntry,
  DefaultFunctionLoweringContext,
  LoweredDefaultResult,
  MutationDefaultGeneratorDescriptor,
  TypedDefaultFunctionCall,
} from '@internal/framework-components/control';
import { timestampNowControlDescriptor } from '@internal/framework-components/control';
import { builtinGeneratorRegistryMetadata, UUID_VERSIONS } from '@internal/ids';
import { sqliteInteger } from '@internal/target-sqlite/data-types';

function executionGenerator(
  id: ExecutionMutationDefaultValue['id'],
  params?: Record<string, unknown>,
): LoweredDefaultResult {
  return {
    ok: true,
    value: {
      kind: 'execution',
      generated: {
        kind: 'generator',
        id,
        ...(params ? { params } : {}),
      },
    },
  };
}

function lowerAutoincrement(): LoweredDefaultResult {
  return {
    ok: true,
    value: {
      kind: 'storage',
      defaultValue: { kind: 'function', expression: 'autoincrement()' },
    },
  };
}

function lowerNow(): LoweredDefaultResult {
  return {
    ok: true,
    value: {
      kind: 'storage',
      defaultValue: { kind: 'function', expression: 'now()' },
    },
  };
}

function lowerUlid(): LoweredDefaultResult {
  return executionGenerator('ulid');
}

function lowerUuid(input: {
  readonly call: TypedDefaultFunctionCall;
  readonly context: DefaultFunctionLoweringContext;
}): LoweredDefaultResult {
  return input.call.args['version'] === UUID_VERSIONS.v7
    ? executionGenerator('uuidv7')
    : executionGenerator('uuidv4');
}

function lowerCuid(): LoweredDefaultResult {
  return executionGenerator('cuid2');
}

function lowerNanoid(input: {
  readonly call: TypedDefaultFunctionCall;
  readonly context: DefaultFunctionLoweringContext;
}): LoweredDefaultResult {
  const size = input.call.args['size'];
  return typeof size === 'number'
    ? executionGenerator('nanoid', { size })
    : executionGenerator('nanoid');
}

const signatures = sqlDefaultFunctionSignatures({ integer: sqliteInteger.id });

const sqliteDefaultFunctionRegistryEntries = [
  ['autoincrement', { ...signatures.autoincrement, lower: lowerAutoincrement }],
  ['now', { ...signatures.now, lower: lowerNow }],
  ['uuid', { ...signatures.uuid, lower: lowerUuid }],
  ['cuid', { ...signatures.cuid, lower: lowerCuid }],
  ['ulid', { ...signatures.ulid, lower: lowerUlid }],
  ['nanoid', { ...signatures.nanoid, lower: lowerNanoid }],
] satisfies ReadonlyArray<readonly [string, ControlMutationDefaultEntry]>;

export function createSqliteDefaultFunctionRegistry(): ReadonlyMap<
  string,
  ControlMutationDefaultEntry
> {
  return new Map(sqliteDefaultFunctionRegistryEntries);
}

export function createSqliteMutationDefaultGeneratorDescriptors(): readonly MutationDefaultGeneratorDescriptor[] {
  return [
    ...builtinGeneratorRegistryMetadata.map(
      ({ id, applicableCodecIds }): MutationDefaultGeneratorDescriptor => ({
        id,
        applicableCodecIds,
      }),
    ),
    timestampNowControlDescriptor(),
  ];
}
