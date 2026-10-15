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
import type { ControlMutationDefaultEntry } from '@internal/framework-components/control';
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

function defaultFunction(
  generatorCalls: NonNullable<ControlMutationDefaultEntry['generatorCalls']>,
): ControlMutationDefaultEntry {
  return {
    lower: () => {
      throw new Error('the printer never lowers a default function');
    },
    generatorCalls,
  };
}

/** The PSL calls of the default functions the Postgres adapter registers, as the printer reads them. */
const adapterDefaultFunctions: ReadonlyMap<string, ControlMutationDefaultEntry> = new Map([
  ['uuid', defaultFunction({ uuidv4: () => 'uuid()', uuidv7: () => 'uuid(7)' })],
  ['cuid', defaultFunction({ cuid2: () => 'cuid(2)' })],
  ['ulid', defaultFunction({ ulid: () => 'ulid()' })],
  [
    'nanoid',
    defaultFunction({
      nanoid: (params) =>
        typeof params?.['size'] === 'number' ? `nanoid(${params['size']})` : 'nanoid()',
    }),
  ],
]);

/**
 * A stand-in for the stack the SQL family hands the printer: the target's own type constructors,
 * field presets, codecs and data types, the type constructors and default functions the adapter
 * contributes, and what `extra` adds. `extra.temporalPresets` joins the target's `temporal.*`
 * presets.
 */
export function testBuildContext(
  extra: {
    readonly types?: AuthoringTypeNamespace;
    readonly temporalPresets?: AuthoringFieldNamespace;
    readonly defaultFunctions?: ReadonlyMap<string, ControlMutationDefaultEntry>;
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
      },
    },
    controlMutationDefaults: {
      defaultFunctionRegistry: new Map([
        ...adapterDefaultFunctions,
        ...(extra.defaultFunctions ?? []),
      ]),
      generatorDescriptors: [],
    },
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
