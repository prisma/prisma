import type { TypeCast } from 'mysql2';

/** The column types whose value may be bytes: a binary column of one of them reads as a Buffer, any other as text in the column's character set. */
const BYTES_OR_TEXT = new Set([
  'TINY_BLOB',
  'MEDIUM_BLOB',
  'LONG_BLOB',
  'BLOB',
  'STRING',
  'VAR_STRING',
]);

/** The column types MySQL sends as bytes whatever their character set. */
const BYTES = new Set(['BIT', 'GEOMETRY']);

/**
 * Hands codecs the text MySQL sends for each column (ADR 155). A JSON column is read as UTF-8, because MySQL reports its character set as binary; a binary string or blob column as its bytes; every other column, numbers and dates included, as text, never as a JavaScript number or `Date`.
 */
export const serverText: TypeCast = (field, next) => {
  if (field.type === 'JSON') return field.string('utf8');
  if (BYTES.has(field.type)) return field.buffer();
  if (BYTES_OR_TEXT.has(field.type)) return next();
  return field.string('utf8');
};
