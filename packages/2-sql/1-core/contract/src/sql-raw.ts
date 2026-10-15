import type { DataTypeId } from '@internal/framework-components/codec';
import { dataTypeId } from '@internal/framework-components/codec';
import { structuredError } from '@internal/utils/structured-error';
import { type } from 'arktype';
import { type SqlDataType, sqlDataType } from './sql-data-type';

export const SQL_RAW_DATA_TYPE_ID: DataTypeId = dataTypeId('sql/raw');

export type SqlRawTypeParams = { readonly sql: string };

/**
 * The data type of a column whose type no other data type claims. Its `sql` parameter is the type
 * exactly as the database catalog prints it, which migrations write and verify compares. It claims
 * no reported type, so introspection never reads a column as raw. It has no literal values: it
 * declares no casts, and its canonical form refuses every value, so a literal default is refused
 * wherever one is read. ADR 273.
 */
export const sqlRawDataType: SqlDataType<SqlRawTypeParams> = sqlDataType<SqlRawTypeParams>(
  SQL_RAW_DATA_TYPE_ID,
  {
    params: type({ sql: 'string > 0' }),
    render: ({ sql }) => sql,
    toCanonicalForm: (value) => {
      throw structuredError(
        'CONTRACT.CAST_REFUSED',
        `A raw column has no literal values, so ${JSON.stringify(value)} cannot be one.`,
        {
          why: 'Prisma does not interpret the values of a raw column, so it cannot write or compare a literal of its type.',
          fix: 'Write the default as a sql expression, such as @default(sql`...`).',
        },
      );
    },
  },
);
