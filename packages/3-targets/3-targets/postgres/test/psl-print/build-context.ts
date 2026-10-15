import type { SqlPslBuildContext } from '@internal/family-sql/control';
import type {
  AuthoringFieldNamespace,
  AuthoringTypeNamespace,
} from '@internal/framework-components/authoring';
import {
  type CodecDescriptorTemplate,
  createDataTypeLookup,
  type DataType,
} from '@internal/framework-components/codec';
import type { LiftedDefaultFunctionCall } from '@internal/framework-components/control';
import { postgresAuthoringFieldPresets, postgresAuthoringTypes } from '../../src/core/authoring';
import { type AnyPostgresCodecDescriptor, postgresCodec } from '../../src/core/codec-descriptor';
import { postgresDataTypeEntries } from '../../src/core/data-type-entries';
import { pgText, postgresDataTypes } from '../../src/core/data-types';
import { postgresCodecDescriptorRegistry } from '../../src/core/registry';
import { postgresPslTypeConstructors } from '../../src/core/type-constructors';

const citextTemplate: CodecDescriptorTemplate = {
  codecId: 'ext/citext@1',
  traits: [],
  paramsSchema: undefined,
  isParameterized: false,
  factory: () => () => {
    throw new Error('the printer never builds a codec');
  },
};

/** A codec the target does not own, as an extension would contribute it, representing text. */
export const extensionCodec: AnyPostgresCodecDescriptor = postgresCodec(citextTemplate, {
  dataType: pgText,
  jsonProjection: (expression) => expression,
});

/** The PSL calls of the default functions the Postgres adapter registers, as the printer reads them. */
const adapterDefaultFunctionCalls: ReadonlyMap<string, LiftedDefaultFunctionCall> = new Map<
  string,
  LiftedDefaultFunctionCall
>([
  ['uuidv4', { functionName: 'uuid', liftArguments: () => '' }],
  ['uuidv7', { functionName: 'uuid', liftArguments: () => '7' }],
  ['cuid2', { functionName: 'cuid', liftArguments: () => '2' }],
  ['ulid', { functionName: 'ulid', liftArguments: () => '' }],
  [
    'nanoid',
    {
      functionName: 'nanoid',
      liftArguments: (params) =>
        typeof params?.['size'] === 'number' ? String(params['size']) : '',
    },
  ],
]);

/**
 * A stand-in for the stack the SQL family hands the printer: the target's own type constructors,
 * field presets, codecs and data types, the type constructors and default functions the adapter
 * contributes, and what `extra` adds. `extra.temporalPresets` joins the target's `temporal.*`
 * presets; `extra.fieldPresets` adds top-level field namespaces.
 */
export function testBuildContext(
  extra: {
    readonly types?: AuthoringTypeNamespace;
    readonly temporalPresets?: AuthoringFieldNamespace;
    readonly fieldPresets?: AuthoringFieldNamespace;
    readonly defaultFunctionCalls?: ReadonlyMap<string, LiftedDefaultFunctionCall>;
    readonly codecs?: readonly AnyPostgresCodecDescriptor[];
    readonly dataTypes?: readonly DataType[];
  } = {},
): SqlPslBuildContext {
  const extraCodecs = new Map((extra.codecs ?? []).map((codec) => [codec.codecId, codec]));
  return {
    authoringContributions: {
      type: {
        ...postgresAuthoringTypes,
        ...postgresPslTypeConstructors,
        ...extra.types,
      },
      field: {
        ...postgresAuthoringFieldPresets,
        temporal: { ...postgresAuthoringFieldPresets.temporal, ...extra.temporalPresets },
        ...extra.fieldPresets,
      },
    },
    defaultFunctionCallsByGenerator: new Map([
      ...adapterDefaultFunctionCalls,
      ...(extra.defaultFunctionCalls ?? []),
    ]),
    codecLookup: {
      get: () => undefined,
      renderOutputTypeFor: () => undefined,
      descriptorFor: (codecId) =>
        extraCodecs.get(codecId) ?? postgresCodecDescriptorRegistry.descriptorFor(codecId),
    },
    dataTypes: {
      entries: postgresDataTypeEntries(),
      lookup: createDataTypeLookup([...postgresDataTypes, ...(extra.dataTypes ?? [])]),
    },
  };
}
