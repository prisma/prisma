import type { AuthoringTypeAliasDescriptor } from '@internal/framework-components/authoring';

const CHAR_CODEC_ID = 'sql/char@1';

/** The column of each identifier format the client generates, named by a type alias that carries no generator, so a foreign key uses it as its key does. ADR 307. */
export const sqlIdentifierTypeAliases = {
  UuidString: {
    kind: 'typeAlias',
    documentation: 'Fixed-length text of 36 characters, the column a UUID is stored in as text.',
    output: { type: { codecId: CHAR_CODEC_ID, typeParams: { length: 36 } } },
  },
  Ulid: {
    kind: 'typeAlias',
    documentation: 'Fixed-length text of 26 characters, the column a ULID is stored in.',
    output: { type: { codecId: CHAR_CODEC_ID, typeParams: { length: 26 } } },
  },
  Nanoid: {
    kind: 'typeAlias',
    documentation:
      'Fixed-length text of 21 characters, the column a nanoid of the default size is stored in.',
    output: { type: { codecId: CHAR_CODEC_ID, typeParams: { length: 21 } } },
  },
  Cuid2: {
    kind: 'typeAlias',
    documentation: 'Fixed-length text of 24 characters, the column a CUID2 is stored in.',
    output: { type: { codecId: CHAR_CODEC_ID, typeParams: { length: 24 } } },
  },
  Ksuid: {
    kind: 'typeAlias',
    documentation: 'Fixed-length text of 27 characters, the column a KSUID is stored in.',
    output: { type: { codecId: CHAR_CODEC_ID, typeParams: { length: 27 } } },
  },
} as const satisfies Record<string, AuthoringTypeAliasDescriptor>;
