import type { DataTypeId } from '@internal/framework-components/codec';
import { dataTypeId } from '@internal/framework-components/codec';
import { type } from 'arktype';
import { type SqlDataType, sqlDataType } from './sql-data-type';

export const SQL_RAW_DATA_TYPE_ID: DataTypeId = dataTypeId('sql/raw');

export type SqlRawTypeParams = { readonly sql: string };

/**
 * The data type of a column whose type no other data type claims. Its `sql` parameter is the type
 * exactly as the database catalog prints it, which migrations write and verify compares. It claims
 * no reported type, so introspection never reads a column as raw. ADR 273.
 */
export const sqlRawDataType: SqlDataType<SqlRawTypeParams> = sqlDataType<SqlRawTypeParams>(
  SQL_RAW_DATA_TYPE_ID,
  {
    params: type({ sql: 'string > 0' }),
    render: ({ sql }) => sql,
  },
);
