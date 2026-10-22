/**
 * How PSL writes a value of each of this target's data types. A quoted string is `mysql/text`; a
 * whole number is the narrowest of `mysql/int` and `mysql/bigint` that holds it, and anything else
 * has no MySQL type in this target and is refused. ADR 254.
 */

import type { JsonValue } from '@internal/contract/types';
import type { DataTypeAuthoringEntry } from '@internal/framework-components/authoring';
import {
  createNumberClassifier,
  numeralText,
  signedRange,
} from '@internal/framework-components/codec';
import { mysqlBigint, mysqlInt, mysqlText } from './data-types';

const classifyMysqlNumber = createNumberClassifier({
  integers: [
    { type: mysqlInt.id, form: 'number', ...signedRange(32) },
    { type: mysqlBigint.id, form: 'text', ...signedRange(64) },
  ],
});

function printNumber(value: JsonValue): string {
  return typeof value === 'number' ? numeralText(value) : String(value);
}

export function mysqlDataTypeEntries(): Readonly<Record<string, DataTypeAuthoringEntry>> {
  return {
    [mysqlText.id]: {
      written: { kind: 'plain', syntax: 'string', parse: (text) => text },
      print: (value) => String(value),
      documentation: 'Text.',
    },
    [mysqlBigint.id]: {
      written: {
        kind: 'plain',
        syntax: 'number',
        types: [mysqlInt.id, mysqlBigint.id],
        classify: classifyMysqlNumber,
      },
      print: printNumber,
      documentation:
        'A whole number, whose type is the narrowest MySQL integer type that holds it.',
    },
  };
}
