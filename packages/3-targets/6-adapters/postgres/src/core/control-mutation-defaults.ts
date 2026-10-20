import type { ExecutionMutationDefaultValue } from '@internal/contract/types';
import {
  sqlBuiltinGeneratorDescriptors,
  sqlDefaultFunctionSignatures,
} from '@internal/family-sql/control';
import type {
  ControlMutationDefaultEntry,
  DefaultFunctionLoweringContext,
  LoweredDefaultResult,
  MutationDefaultGeneratorDescriptor,
  TypedDefaultFunctionCall,
} from '@internal/framework-components/control';
import { timestampNowControlDescriptor } from '@internal/framework-components/control';
import { CUID_VERSION, UUID_VERSIONS } from '@internal/ids';
import { postgresNowGeneratorControlDescriptors } from '@internal/target-postgres/control';
import { pgChar, pgInt4, pgText, pgUuid, pgVarchar } from '@internal/target-postgres/data-types';

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

function printNanoidArguments(params: Readonly<Record<string, unknown>> | undefined): string {
  const size = params?.['size'];
  return typeof size === 'number' ? String(size) : '';
}

const signatures = sqlDefaultFunctionSignatures({ integer: pgInt4.id });

const postgresDefaultFunctionRegistryEntries: ReadonlyArray<
  readonly [string, ControlMutationDefaultEntry]
> = [
  ['autoincrement', { ...signatures.autoincrement, lower: lowerAutoincrement }],
  ['now', { ...signatures.now, lower: lowerNow }],
  [
    'uuid',
    {
      ...signatures.uuid,
      lower: lowerUuid,
      printArguments: { uuidv4: () => '', uuidv7: () => String(UUID_VERSIONS.v7) },
    },
  ],
  [
    'cuid',
    {
      ...signatures.cuid,
      lower: lowerCuid,
      printArguments: { cuid2: () => String(CUID_VERSION) },
    },
  ],
  ['ulid', { ...signatures.ulid, lower: lowerUlid, printArguments: { ulid: () => '' } }],
  [
    'nanoid',
    {
      ...signatures.nanoid,
      lower: lowerNanoid,
      printArguments: { nanoid: printNanoidArguments },
    },
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
    ...sqlBuiltinGeneratorDescriptors({
      text: [pgText.id, pgChar.id, pgVarchar.id],
      uuid: [pgUuid.id],
    }),
    timestampNowControlDescriptor(),
    ...postgresNowGeneratorControlDescriptors(),
  ];
}
