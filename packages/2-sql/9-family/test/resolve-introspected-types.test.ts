import type { DataType } from '@internal/framework-components/codec';
import { sqlDataType } from '@internal/sql-contract/data-type';
import {
  type ReportedSqlType,
  type SqlColumnIRInput,
  SqlSchemaIR,
  type SqlTableIRInput,
} from '@internal/sql-schema-ir/types';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { resolveIntrospectedTypes } from '../src/core/resolve-introspected-types';

const text = sqlDataType('test/text', {
  read: (json) => json,
  texts: [{ text: 'text', written: true, catalog: true }],
});
const numeric = sqlDataType('test/numeric', {
  read: (json) => json,
  params: type({ 'precision?': 'number.integer >= 1', 'scale?': 'number.integer' }),
  texts: [
    { text: 'numeric', written: true, catalog: true },
    { text: 'numeric({precision})' },
    { text: 'numeric({precision},{scale})', written: true, catalog: true },
  ],
  normalize: (params) =>
    params.precision !== undefined && params.scale === undefined ? { ...params, scale: 0 } : params,
});
const enumType = sqlDataType('test/enum', {
  read: (json) => json,
  params: type({ typeName: 'string > 0' }),
  claimsKind: 'enum',
  render: ({ typeName }) => `"${typeName}"`,
  fromReported: (reported) => ({ typeName: reported.name ?? '' }),
});
const thing = sqlDataType('testext/thing', {
  read: (json) => json,
  params: type({ size: 'number.integer >= 1' }),
  texts: [{ text: 'thing({size})', written: true, catalog: true }],
});

const baseTypes: readonly DataType[] = [text, numeric, enumType];

const reported = (text: string, kind?: string): ReportedSqlType => ({
  text,
  kind,
  schema: 'public',
  name: text,
});

const column = (
  name: string,
  reportedType: ReportedSqlType | undefined,
  extra: Partial<SqlColumnIRInput> = {},
): SqlColumnIRInput => ({
  name,
  nativeType: reportedType?.text ?? 'text',
  nullable: false,
  ...(reportedType === undefined ? {} : { reportedType }),
  ...extra,
});

const tableOf = (columns: readonly SqlColumnIRInput[]): SqlTableIRInput => ({
  name: 't',
  columns: Object.fromEntries(columns.map((input) => [input.name, input])),
  foreignKeys: [],
  uniques: [],
  indexes: [],
  primaryKey: { columns: ['id'] },
});

function resolvedColumns(columns: readonly SqlColumnIRInput[], dataTypes = baseTypes) {
  const schema = new SqlSchemaIR({ tables: { t: tableOf(columns) } });
  const resolved = resolveIntrospectedTypes(schema, dataTypes);
  if (!(resolved instanceof SqlSchemaIR)) throw new Error('expected a SqlSchemaIR');
  return Object.fromEntries(
    Object.entries(resolved.tables['t']?.columns ?? {}).map(([name, resolvedColumn]) => [
      name,
      {
        dataType: resolvedColumn.dataType?.id,
        typeParams: resolvedColumn.typeParams,
        many: resolvedColumn.many,
      },
    ]),
  );
}

describe('resolveIntrospectedTypes', () => {
  it('gives a column of a base type its data type and no parameters', () => {
    expect(resolvedColumns([column('id', reported('text'))])).toEqual({
      id: { dataType: 'test/text', typeParams: {}, many: undefined },
    });
  });

  it('gives a parameterised type its parameters in normal form', () => {
    expect(
      resolvedColumns([
        column('short', reported('numeric(10)')),
        column('long', reported('NUMERIC(10, 0)')),
      ]),
    ).toEqual({
      short: { dataType: 'test/numeric', typeParams: { precision: 10, scale: 0 }, many: undefined },
      long: { dataType: 'test/numeric', typeParams: { precision: 10, scale: 0 }, many: undefined },
    });
  });

  it('resolves the element type of a list and keeps the column a list', () => {
    expect(resolvedColumns([column('tags', reported('numeric(4,2)'), { many: true })])).toEqual({
      tags: { dataType: 'test/numeric', typeParams: { precision: 4, scale: 2 }, many: true },
    });
  });

  it('gives a type of a kind the parameters its claimant reads from the report', () => {
    expect(resolvedColumns([column('mood', reported('mood', 'enum'))])).toEqual({
      mood: { dataType: 'test/enum', typeParams: { typeName: 'mood' }, many: undefined },
    });
  });

  it('leaves a type nothing claims without a data type', () => {
    expect(
      resolvedColumns([
        column('domain', reported('positive', 'domain')),
        column('unknown', reported('hstore')),
        column('handBuilt', undefined),
      ]),
    ).toEqual({
      domain: { dataType: undefined, typeParams: undefined, many: undefined },
      unknown: { dataType: undefined, typeParams: undefined, many: undefined },
      handBuilt: { dataType: undefined, typeParams: undefined, many: undefined },
    });
  });

  it('resolves an extension type only when its pack is in the stack', () => {
    const columns = [column('thing', reported('thing(3)'))];
    expect({
      with: resolvedColumns(columns, [...baseTypes, thing]),
      without: resolvedColumns(columns),
    }).toEqual({
      with: { thing: { dataType: 'testext/thing', typeParams: { size: 3 }, many: undefined } },
      without: { thing: { dataType: undefined, typeParams: undefined, many: undefined } },
    });
  });

  it('keeps every other part of the schema as introspected', () => {
    const schema = new SqlSchemaIR({
      tables: {
        t: tableOf([
          column('id', reported('text'), { default: "'a'::text" }),
          column('unknown', reported('hstore')),
        ]),
      },
      annotations: { test: { note: 1 } },
    });
    const resolved = resolveIntrospectedTypes(schema, baseTypes);
    if (!(resolved instanceof SqlSchemaIR)) throw new Error('expected a SqlSchemaIR');

    expect({
      json: JSON.stringify(resolved),
      frozen: Object.isFrozen(resolved) && Object.isFrozen(resolved.tables['t']),
      unclaimedKept:
        resolved.tables['t']?.columns['unknown'] === schema.tables['t']?.columns['unknown'],
      reportedType: resolved.tables['t']?.columns['id']?.reportedType,
    }).toEqual({
      json: JSON.stringify(schema),
      frozen: true,
      unclaimedKept: true,
      reportedType: reported('text'),
    });
  });
});
