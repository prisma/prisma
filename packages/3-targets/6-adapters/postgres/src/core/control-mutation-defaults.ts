import type { ExecutionMutationDefaultValue } from '@prisma-next/contract/types';
import { timestampNowControlDescriptor } from '@prisma-next/family-sql/control';
import type { AuthoringTypeNamespace } from '@prisma-next/framework-components/authoring';
import type {
  ControlMutationDefaultEntry,
  DefaultFunctionLoweringContext,
  LoweredDefaultResult,
  MutationDefaultGeneratorDescriptor,
  TypedDefaultFunctionCall,
} from '@prisma-next/framework-components/control';
import { builtinGeneratorRegistryMetadata } from '@prisma-next/ids';
import type { FuncCallSig } from '@prisma-next/psl-parser';
import { int, num, oneOf, optional, str } from '@prisma-next/psl-parser';

function invalidArgumentDiagnostic(input: {
  readonly context: DefaultFunctionLoweringContext;
  readonly span: TypedDefaultFunctionCall['span'];
  readonly message: string;
}): LoweredDefaultResult {
  return {
    ok: false,
    diagnostic: {
      code: 'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT',
      message: input.message,
      sourceId: input.context.sourceId,
      span: input.span,
    },
  };
}

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
  return input.call.args['version'] === 7
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

function lowerDbgenerated(input: {
  readonly call: TypedDefaultFunctionCall;
  readonly context: DefaultFunctionLoweringContext;
}): LoweredDefaultResult {
  const expression = input.call.args['expression'];
  if (typeof expression !== 'string' || expression.trim().length === 0) {
    return invalidArgumentDiagnostic({
      context: input.context,
      span: input.call.span,
      message: 'Default function "dbgenerated" argument cannot be empty.',
    });
  }
  return {
    ok: true,
    value: {
      kind: 'storage',
      defaultValue: { kind: 'function', expression },
    },
  };
}

const nowSig: FuncCallSig = {};
const autoincrementSig: FuncCallSig = {};
const ulidSig: FuncCallSig = {};
const uuidSig: FuncCallSig = {
  positional: [{ key: 'version', type: optional(oneOf(num(4), num(7))) }],
};
const cuidSig: FuncCallSig = { positional: [{ key: 'version', type: num(2) }] };
const nanoidSig: FuncCallSig = {
  positional: [{ key: 'size', type: optional(int({ min: 2, max: 255 })) }],
};
const dbgeneratedSig: FuncCallSig = { positional: [{ key: 'expression', type: str() }] };

const postgresDefaultFunctionRegistryEntries = [
  [
    'autoincrement',
    {
      signature: autoincrementSig,
      lower: lowerAutoincrement,
      usageSignatures: ['autoincrement()'],
    },
  ],
  ['now', { signature: nowSig, lower: lowerNow, usageSignatures: ['now()'] }],
  [
    'uuid',
    { signature: uuidSig, lower: lowerUuid, usageSignatures: ['uuid()', 'uuid(4)', 'uuid(7)'] },
  ],
  ['cuid', { signature: cuidSig, lower: lowerCuid, usageSignatures: ['cuid(2)'] }],
  ['ulid', { signature: ulidSig, lower: lowerUlid, usageSignatures: ['ulid()'] }],
  [
    'nanoid',
    { signature: nanoidSig, lower: lowerNanoid, usageSignatures: ['nanoid()', 'nanoid(<2-255>)'] },
  ],
  [
    'dbgenerated',
    { signature: dbgeneratedSig, lower: lowerDbgenerated, usageSignatures: ['dbgenerated("...")'] },
  ],
] satisfies ReadonlyArray<readonly [string, ControlMutationDefaultEntry]>;

/**
 * The base PSL scalars as zero-arg type constructors in the unified authoring
 * channel, with explicit `nativeType` values pinned to the codec manifests
 * (`codecLookup.targetTypesFor(codecId)[0]`).
 *
 * The type position is the only storage decider: a mutation-default generator
 * (`@default(uuid())`) never re-picks a column's storage.
 */
export const postgresScalarAuthoringTypes = {
  String: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/text@1', nativeType: 'text' },
  },
  Boolean: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/bool@1', nativeType: 'bool' },
  },
  Int: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/int4@1', nativeType: 'int4' },
  },
  BigInt: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/int8@1', nativeType: 'int8' },
  },
  Float: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/float8@1', nativeType: 'float8' },
  },
  Decimal: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/numeric@1', nativeType: 'numeric' },
  },
  DateTime: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/timestamptz@1', nativeType: 'timestamptz' },
  },
  Json: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/json@1', nativeType: 'json' },
  },
  Jsonb: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/jsonb@1', nativeType: 'jsonb' },
  },
  Bytes: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/bytea@1', nativeType: 'bytea' },
  },
} as const satisfies AuthoringTypeNamespace;

export const postgresNativeAuthoringTypes = {
  VarChar: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'length', integer: true, minimum: 1, optional: true }],
    output: {
      codecId: 'sql/varchar@1',
      nativeType: 'character varying',
      typeParams: { length: { kind: 'arg', index: 0 } },
    },
  },
  Char: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'length', integer: true, minimum: 1, optional: true }],
    output: {
      codecId: 'sql/char@1',
      nativeType: 'character',
      typeParams: { length: { kind: 'arg', index: 0 } },
    },
  },
  Numeric: {
    kind: 'typeConstructor',
    args: [
      { kind: 'number', name: 'precision', integer: true, minimum: 1, optional: true },
      { kind: 'number', name: 'scale', integer: true, minimum: 0, optional: true },
    ],
    output: {
      codecId: 'pg/numeric@1',
      nativeType: 'numeric',
      typeParams: {
        precision: { kind: 'arg', index: 0 },
        scale: { kind: 'arg', index: 1 },
      },
    },
  },
  Timestamp: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'precision', integer: true, minimum: 0, optional: true }],
    output: {
      codecId: 'pg/timestamp@1',
      nativeType: 'timestamp',
      typeParams: { precision: { kind: 'arg', index: 0 } },
    },
  },
  Timestamptz: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'precision', integer: true, minimum: 0, optional: true }],
    output: {
      codecId: 'pg/timestamptz@1',
      nativeType: 'timestamptz',
      typeParams: { precision: { kind: 'arg', index: 0 } },
    },
  },
  Time: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'precision', integer: true, minimum: 0, optional: true }],
    output: {
      codecId: 'pg/time@1',
      nativeType: 'time',
      typeParams: { precision: { kind: 'arg', index: 0 } },
    },
  },
  Timetz: {
    kind: 'typeConstructor',
    args: [{ kind: 'number', name: 'precision', integer: true, minimum: 0, optional: true }],
    output: {
      codecId: 'pg/timetz@1',
      nativeType: 'timetz',
      typeParams: { precision: { kind: 'arg', index: 0 } },
    },
  },
  Uuid: { kind: 'typeConstructor', output: { codecId: 'pg/uuid@1', nativeType: 'uuid' } },
  Inet: { kind: 'typeConstructor', output: { codecId: 'pg/inet@1', nativeType: 'inet' } },
  SmallInt: { kind: 'typeConstructor', output: { codecId: 'pg/int2@1', nativeType: 'int2' } },
  Real: { kind: 'typeConstructor', output: { codecId: 'pg/float4@1', nativeType: 'float4' } },
  Date: { kind: 'typeConstructor', output: { codecId: 'pg/date@1', nativeType: 'date' } },
} as const satisfies AuthoringTypeNamespace;

export const postgresAuthoringTypes = {
  ...postgresScalarAuthoringTypes,
  ...postgresNativeAuthoringTypes,
} as const satisfies AuthoringTypeNamespace;

export function createPostgresDefaultFunctionRegistry(): ReadonlyMap<
  string,
  ControlMutationDefaultEntry
> {
  return new Map(postgresDefaultFunctionRegistryEntries);
}

export function createPostgresMutationDefaultGeneratorDescriptors(): readonly MutationDefaultGeneratorDescriptor[] {
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
