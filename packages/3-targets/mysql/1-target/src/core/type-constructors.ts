import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';
import { SQL_VARCHAR_CODEC_ID } from '@internal/sql-relational-core/ast';
import { MYSQL_BIGINT_CODEC_ID, MYSQL_DATETIME_CODEC_ID, MYSQL_INT_CODEC_ID } from './codec-ids';

/** The length of a `String` column: what Prisma ORM 7 used, and short enough for MySQL to index the column. */
export const MYSQL_STRING_LENGTH = 191;

/**
 * The base PSL scalars as zero-arg type constructors. Each names a codec; the column's database type is its data type's. The target contributes them, so PSL and the TypeScript builder's `type.*` see the same names.
 */
export const mysqlScalarTypeConstructors = {
  String: {
    kind: 'typeConstructor',
    documentation: `Text of at most ${MYSQL_STRING_LENGTH} characters, stored as MySQL varchar(${MYSQL_STRING_LENGTH}) so that it can be indexed.`,
    output: { codecId: SQL_VARCHAR_CODEC_ID, typeParams: { length: MYSQL_STRING_LENGTH } },
  },
  Int: {
    kind: 'typeConstructor',
    inferred: true,
    documentation:
      'A signed 32-bit integer stored as MySQL int and represented as a JavaScript number.',
    output: { codecId: MYSQL_INT_CODEC_ID },
  },
  BigInt: {
    kind: 'typeConstructor',
    inferred: true,
    documentation:
      'A signed 64-bit integer stored as MySQL bigint and represented as a JavaScript bigint.',
    output: { codecId: MYSQL_BIGINT_CODEC_ID },
  },
  DateTime: {
    kind: 'typeConstructor',
    inferred: true,
    documentation:
      'A date and time with millisecond precision, stored as MySQL datetime(3) in UTC and represented as a JavaScript Date.',
    output: { codecId: MYSQL_DATETIME_CODEC_ID, typeParams: { precision: 3 } },
  },
} as const satisfies AuthoringTypeNamespace;
