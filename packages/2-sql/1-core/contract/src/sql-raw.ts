import type { DataTypeId } from '@internal/framework-components/codec';
import { dataTypeId } from '@internal/framework-components/codec';
import { structuredError } from '@internal/utils/structured-error';
import { type } from 'arktype';
import { type SqlDataType, sqlDataType } from './sql-data-type';

export const SQL_RAW_DATA_TYPE_ID: DataTypeId = dataTypeId('sql/raw');

export type SqlRawTypeParams = { readonly sql: string };

const UNSAFE_RAW_TYPE_TEXT = /;|--|\/\*|\$\$/;

/** Whether `text` has a comma outside parentheses, or parentheses that do not balance. */
function hasTopLevelCommaOrUnbalancedParentheses(text: string): boolean {
  let depth = 0;
  for (const character of text) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) return true;
    if (depth < 0) return true;
  }
  return depth !== 0;
}

/** Returns undefined when `text` may be written as a column's type, else the reason. */
export function checkRawTypeText(text: string): string | undefined {
  const refused =
    text.trim() === '' ||
    text !== text.trim() ||
    UNSAFE_RAW_TYPE_TEXT.test(text) ||
    hasTopLevelCommaOrUnbalancedParentheses(text);
  return refused
    ? 'A raw type is one type name as the database catalog prints it, such as tsvector or geometry(Point,4326): it must not be blank, start or end with whitespace, or contain semicolons, SQL comment tokens, dollar quoting, a comma outside parentheses or unbalanced parentheses.'
    : undefined;
}

const sqlRawParams = type({ sql: 'string' }).narrow((params, ctx) => {
  const refused = checkRawTypeText(params.sql);
  return refused === undefined || ctx.reject({ path: ['sql'], message: refused });
});

/**
 * The refusal of a literal value of a raw column, which has none: Prisma does not interpret a raw
 * column's values. Every literal default reaches it through the data type's canonical form.
 */
function refuseLiteralValue(): never {
  throw structuredError(
    'CONTRACT.LITERAL_VALUES_ABSENT',
    'A raw column has no literal values, so its default cannot be a literal. Write the default as a SQL expression: sql`...`.',
    {
      why: 'Prisma does not interpret the values of a raw column, so it cannot write or compare a literal of its type.',
      fix: 'Write the default as a sql expression, such as @default(sql`...`) in a schema or .default(sql`...`) in TypeScript.',
    },
  );
}

/**
 * The data type of a column whose type no other data type claims. Its `sql` parameter is the type
 * exactly as the database catalog prints it, which migrations write and verify compares. It claims
 * no reported type, so introspection never reads a column as raw. It has no literal values: it
 * declares no casts, and its canonical form refuses every value. ADR 273.
 */
export const sqlRawDataType: SqlDataType<SqlRawTypeParams> = sqlDataType<SqlRawTypeParams>(
  SQL_RAW_DATA_TYPE_ID,
  {
    params: sqlRawParams,
    nameIsCatalogText: true,
    render: ({ sql }) => sql,
    toCanonicalForm: refuseLiteralValue,
  },
);
