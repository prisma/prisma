import {
  pgBytea,
  pgDate,
  pgJson,
  pgJsonb,
  pgTime,
  pgTimestamp,
  pgTimestamptz,
  pgTimetz,
} from './data-types';
import { postgresTargetDescriptorMeta } from './descriptor-meta';
import {
  defaultForeignKeyName,
  defaultPrimaryKeyName,
} from './migrations/default-constraint-names';
import { postgresNowGeneratorIdFor } from './now-generators';
import { postgresCreateNamespace } from './postgres-schema';
import { prisma7TemporalTagBody } from './prisma7-temporal-defaults';
import { prisma7PostgresTypeMap } from './prisma7-type-map';
import { junctionRelationFieldNames } from './psl-infer/junction-relation-field-names';

/** The tag of each date and time type a Prisma 7 `DateTime` default can be written on. */
const TEMPORAL_TAGS: ReadonlyMap<string, string> = new Map([
  [pgTimestamp.id, 'timestamp'],
  [pgTimestamptz.id, 'timestamptz'],
  [pgDate.id, 'date'],
  [pgTime.id, 'time'],
  [pgTimetz.id, 'timetz'],
]);

function base64ToHex(base64: string): string | undefined {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return undefined;
  return `\\x${Buffer.from(base64, 'base64').toString('hex')}`;
}

/**
 * What the Postgres target supplies to the Prisma 7 interpreter. A `Bytes` or
 * `DateTime` default is read through its column type's tag, as the current
 * schema language reads it: a `Bytes` default's base64 as the hex body of
 * `bytea`, and a `DateTime` default as the body of the date or time tag that
 * keeps what the written value means on the column.
 */
export const prisma7PostgresBinding = {
  target: postgresTargetDescriptorMeta,
  createNamespace: postgresCreateNamespace,
  providers: ['postgresql', 'postgres'],
  typeMap: prisma7PostgresTypeMap,
  nativeEnum: { entityKind: 'native_enum', typeConstructor: ['pg', 'enum'] },
  indexTypes: {
    BTree: 'btree',
    Hash: 'hash',
    Gin: 'gin',
    Gist: 'gist',
    SpGist: 'spgist',
    Brin: 'brin',
  },
  /** `NAMEDATALEN - 1`. */
  identifierMaxBytes: 63,
  defaultConstraintNames: { primaryKey: defaultPrimaryKeyName, foreignKey: defaultForeignKeyName },
  junctionRelationFieldNames,
  updatedAtGeneratorId: postgresNowGeneratorIdFor,
  literalDefaultForm: ({ dataType }: { readonly dataType: string }) => {
    if (dataType === pgJson.id || dataType === pgJsonb.id) return { kind: 'json' } as const;
    if (dataType === pgBytea.id) return { kind: 'tag', tag: 'bytea', body: base64ToHex } as const;
    const tag = TEMPORAL_TAGS.get(dataType);
    if (tag === undefined) return undefined;
    return {
      kind: 'tag',
      tag,
      body: (text: string) => prisma7TemporalTagBody(text, dataType),
    } as const;
  },
} as const;
