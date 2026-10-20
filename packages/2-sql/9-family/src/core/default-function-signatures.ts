import type { DataTypeSupport } from '@internal/framework-components/authoring';
import type { DataTypeId } from '@internal/framework-components/codec';
import { CUID_VERSION, NANOID_SIZE, UUID_VERSIONS } from '@internal/ids';
import {
  type ArgType,
  type AttributeCtx,
  dataTypeValue,
  type FuncCallSig,
  leafDiagnostic,
  optional,
  refineArg,
} from '@internal/psl-parser';
import type { DefaultFunctionSignature } from '@internal/sql-contract-psl/attribute-specs';
import { InternalError } from '@internal/utils/internal-error';
import { notOk, ok } from '@internal/utils/result';

export interface SqlDefaultFunctionDeclaration {
  readonly signature: DefaultFunctionSignature;
  readonly usageSignatures: readonly string[];
}

export type SqlDefaultFunctionName = 'autoincrement' | 'now' | 'ulid' | 'uuid' | 'cuid' | 'nanoid';

/**
 * The signatures of the SQL family's default functions. Each integer argument is a value of `integer`, the target's integer data type, read and cast like a default, then checked by its function.
 */
export function sqlDefaultFunctionSignatures({
  integer,
}: {
  readonly integer: DataTypeId;
}): Readonly<Record<SqlDefaultFunctionName, SqlDefaultFunctionDeclaration>> {
  return {
    autoincrement: {
      signature: { documentation: 'Generates an increasing integer value in the database.' },
      usageSignatures: ['autoincrement()'],
    },
    now: {
      signature: { documentation: 'Uses the current database timestamp as the default value.' },
      usageSignatures: ['now()'],
    },
    ulid: {
      signature: { documentation: 'Generates a ULID when a value is not supplied.' },
      usageSignatures: ['ulid()'],
    },
    uuid: {
      signature: (dataTypes) => uuidSignature(integer, dataTypes),
      usageSignatures: ['uuid()', `uuid(${UUID_VERSIONS.v4})`, `uuid(${UUID_VERSIONS.v7})`],
    },
    cuid: {
      signature: (dataTypes) => cuidSignature(integer, dataTypes),
      usageSignatures: [`cuid(${CUID_VERSION})`],
    },
    nanoid: {
      signature: (dataTypes) => nanoidSignature(integer, dataTypes),
      usageSignatures: ['nanoid()', `nanoid(<${NANOID_SIZE.min}-${NANOID_SIZE.max}>)`],
    },
  };
}

function uuidSignature(integer: DataTypeId, dataTypes: DataTypeSupport): FuncCallSig {
  const versions = [UUID_VERSIONS.v4, UUID_VERSIONS.v7];
  return {
    documentation: 'Generates a UUID when a value is not supplied.',
    positional: [
      {
        key: 'version',
        type: optional(
          checkedInteger(integer, dataTypes, versions, (version, written) =>
            versions.some((allowed) => allowed === version)
              ? undefined
              : `uuid: version must be ${UUID_VERSIONS.v4} or ${UUID_VERSIONS.v7}, got ${written}`,
          ),
        ),
        documentation: `The UUID version: \`${UUID_VERSIONS.v4}\` or \`${UUID_VERSIONS.v7}\`. Defaults to \`${UUID_VERSIONS.v4}\`.`,
      },
    ],
  };
}

function cuidSignature(integer: DataTypeId, dataTypes: DataTypeSupport): FuncCallSig {
  return {
    documentation: 'Generates a CUID2 identifier when a value is not supplied.',
    positional: [
      {
        key: 'version',
        type: checkedInteger(integer, dataTypes, [CUID_VERSION], (version, written) =>
          version === CUID_VERSION
            ? undefined
            : `cuid: version must be ${CUID_VERSION}, got ${written}`,
        ),
        documentation: `The CUID version. Only \`${CUID_VERSION}\` is supported.`,
      },
    ],
  };
}

function nanoidSignature(integer: DataTypeId, dataTypes: DataTypeSupport): FuncCallSig {
  return {
    documentation: 'Generates a Nano ID when a value is not supplied.',
    positional: [
      {
        key: 'size',
        type: optional(
          checkedInteger(integer, dataTypes, [], (size, written) =>
            size >= NANOID_SIZE.min && size <= NANOID_SIZE.max
              ? undefined
              : `nanoid: size must be between ${NANOID_SIZE.min} and ${NANOID_SIZE.max}, got ${written}`,
          ),
        ),
        documentation: `The identifier length, from \`${NANOID_SIZE.min}\` through \`${NANOID_SIZE.max}\`. Omit to use the generator default.`,
      },
    ],
  };
}

/**
 * One value of the integer data type, as a number, refused at the argument with the function's message when `refusal` returns one.
 */
function checkedInteger(
  integer: DataTypeId,
  dataTypes: DataTypeSupport,
  suggestions: readonly number[],
  refusal: (value: number, written: string) => string | undefined,
): ArgType<number, AttributeCtx> {
  return refineArg(
    dataTypeValue(integer, dataTypes, { suggestions: suggestions.map(String) }),
    ({ value }, arg, ctx) => {
      const stored = value.value;
      if (typeof stored !== 'number' && typeof stored !== 'string') {
        throw new InternalError(
          `Data type "${integer}" stores an integer as ${typeof stored}, not a number or digit text.`,
        );
      }
      const message = refusal(Number(stored), String(stored));
      return message === undefined
        ? ok(Number(stored))
        : notOk([leafDiagnostic(ctx, arg, message, 'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT')]);
    },
  );
}
