import { sqlBuiltinGeneratorDescriptors, sqlDefaultFunctions } from '@internal/family-sql/control';
import type {
  ControlMutationDefaultEntry,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/control';
import { timestampNowControlDescriptor } from '@internal/framework-components/control';
import { CUID_VERSION, UUID_VERSIONS } from '@internal/ids';
import { postgresNowGeneratorControlDescriptors } from '@internal/target-postgres/control';
import { pgInt4, pgUuid } from '@internal/target-postgres/data-types';

function printNanoidArguments(params: Readonly<Record<string, unknown>> | undefined): string {
  const size = params?.['size'];
  return typeof size === 'number' ? String(size) : '';
}

const functions = sqlDefaultFunctions({ integer: pgInt4.id });

const postgresDefaultFunctionRegistryEntries: ReadonlyArray<
  readonly [string, ControlMutationDefaultEntry]
> = [
  ['autoincrement', functions.autoincrement],
  ['now', functions.now],
  [
    'uuid',
    {
      ...functions.uuid,
      printArguments: { uuidv4: () => '', uuidv7: () => String(UUID_VERSIONS.v7) },
    },
  ],
  [
    'cuid',
    {
      ...functions.cuid,
      printArguments: { cuid2: () => String(CUID_VERSION) },
    },
  ],
  ['ulid', { ...functions.ulid, printArguments: { ulid: () => '' } }],
  [
    'nanoid',
    {
      ...functions.nanoid,
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
    ...sqlBuiltinGeneratorDescriptors({ uuid: [pgUuid.id] }),
    timestampNowControlDescriptor(),
    ...postgresNowGeneratorControlDescriptors(),
  ];
}
