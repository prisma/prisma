import type {
  ResolvedColumnValueObject,
  ResolvedValueObject,
  ResolvedValueObjectField,
  ResolvedValueObjectFieldType,
} from '@internal/sql-contract/check-expressions';
import { describe, expect, it } from 'vitest';
import { postgresRenderCheckExpressions } from '../src/core/check-expressions';
import { postgresCodecDescriptorRegistry } from '../src/core/registry';

function scalar(
  codecId: string,
  values: readonly (string | number)[] | undefined = undefined,
): ResolvedValueObjectFieldType {
  return { kind: 'scalar', codecId, values };
}

function member(
  type: ResolvedValueObjectFieldType,
  options: Partial<Pick<ResolvedValueObjectField, 'nullable' | 'many'>> = {},
): ResolvedValueObjectField {
  return { nullable: false, many: false, ...options, type };
}

function holding(valueObject: ResolvedValueObject): ResolvedValueObjectFieldType {
  return { kind: 'valueObject', valueObject };
}

function render(
  valueObject: ResolvedValueObject,
  column: Partial<Pick<ResolvedColumnValueObject, 'nullable' | 'many'>> = {},
): readonly { readonly kind: string; readonly expression: string }[] {
  return postgresRenderCheckExpressions(
    {
      tableName: 'user',
      columnName: 'address',
      many: false,
      memberValues: undefined,
      valueObject: { nullable: false, many: false, ...column, valueObject },
    },
    postgresCodecDescriptorRegistry,
  ).map(({ kind, expression }) => ({ kind, expression }));
}

const street = member(scalar('pg/text@1'));
const flat: ResolvedValueObject = { fields: { street } };

const isObject = '$.type() == "object"';
const hasStreet = 'exists($.keyvalue() ? (@.key == "street" && (@.value.type() == "string")))';
const onlyStreet = '!exists($.keyvalue() ? (@.key != "street"))';

describe('postgresRenderCheckExpressions for a column that holds a value object', () => {
  it('requires an object with each required member, of its JSON type, and no other key', () => {
    expect(render(flat)).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && ${hasStreet} && ${onlyStreet}') IS TRUE`,
      },
    ]);
  });

  it('accepts SQL NULL and JSON null in a nullable column', () => {
    expect(render(flat, { nullable: true })).toEqual([
      {
        kind: 'valueObject',
        expression: `"address" IS NULL OR jsonb_path_match("address", 'strict $.type() == "null" || (${isObject} && ${hasStreet} && ${onlyStreet})') IS TRUE`,
      },
    ]);
  });

  it('lets a nullable member be absent or JSON null', () => {
    const zip = member(scalar('pg/int4@1'), { nullable: true });
    expect(render({ fields: { zip } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && !exists($.keyvalue() ? (@.key == "zip" && !(@.value.type() == "null" || (@.value.type() == "number")))) && !exists($.keyvalue() ? (@.key != "zip"))') IS TRUE`,
      },
    ]);
  });

  it('checks list members and their element nullability', () => {
    const tags = member(scalar('pg/text@1'), { many: { elementNullable: false } });
    const flags = member(scalar('pg/bool@1'), { many: { elementNullable: true } });
    expect(render({ fields: { tags, flags } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "flags" && (@.value.type() == "array" && !exists(@.value[*] ? (!(@.type() == "null" || (@.type() == "boolean"))))))) && exists($.keyvalue() ? (@.key == "tags" && (@.value.type() == "array" && !exists(@.value[*] ? (!((@.type() == "string"))))))) && !exists($.keyvalue() ? (@.key != "flags" && @.key != "tags"))') IS TRUE`,
      },
    ]);
  });

  it('restricts an enum member to its value set', () => {
    const kind = member(scalar('pg/text@1', ['home', "o'brien"]));
    expect(render({ fields: { kind } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "kind" && (@.value.type() == "string" && (@.value == "home" || @.value == "o''brien")))) && !exists($.keyvalue() ? (@.key != "kind"))') IS TRUE`,
      },
    ]);
  });

  it('restricts a numeric enum member to its value set', () => {
    const rank = member(scalar('pg/int4@1', [1, -2]));
    expect(render({ fields: { rank } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "rank" && (@.value.type() == "number" && (@.value == 1 || @.value == -2)))) && !exists($.keyvalue() ? (@.key != "rank"))') IS TRUE`,
      },
    ]);
  });

  it('inlines a nested value object and a list of them', () => {
    const geo = member(holding(flat));
    const stops = member(holding(flat), { many: { elementNullable: false } });
    const nestedAt = (path: string) =>
      `${path}.type() == "object" && exists(${path}.keyvalue() ? (@.key == "street" && (@.value.type() == "string"))) && !exists(${path}.keyvalue() ? (@.key != "street"))`;
    expect(render({ fields: { geo, stops } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "geo" && (${nestedAt('@.value')}))) && exists($.keyvalue() ? (@.key == "stops" && (@.value.type() == "array" && !exists(@.value[*] ? (!((${nestedAt('@')}))))))) && !exists($.keyvalue() ? (@.key != "geo" && @.key != "stops"))') IS TRUE`,
      },
    ]);
  });

  it('accepts any object where a value object refers back into itself', () => {
    const children = member({ kind: 'anyObject' }, { many: { elementNullable: false } });
    expect(render({ fields: { children } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "children" && (@.value.type() == "array" && !exists(@.value[*] ? (!((@.type() == "object"))))))) && !exists($.keyvalue() ? (@.key != "children"))') IS TRUE`,
      },
    ]);
  });

  it('checks a list column as an array of the value object', () => {
    expect(render(flat, { many: { elementNullable: false } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict $.type() == "array" && !exists($[*] ? (!((@.type() == "object" && exists(@.keyvalue() ? (@.key == "street" && (@.value.type() == "string"))) && !exists(@.keyvalue() ? (@.key != "street"))))))') IS TRUE`,
      },
    ]);
  });

  it('refuses JSON null for a required member whose codec declares presence only, and checks only the presence of a JSON member', () => {
    const bytes = member(scalar('pg/bytea@1'));
    const data = member(scalar('pg/jsonb@1'));
    const notes = member(scalar('pg/jsonb@1'), { nullable: true });
    const blobs = member(scalar('pg/bytea@1'), { many: { elementNullable: false } });
    expect(render({ fields: { blobs, bytes, data, notes } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "blobs" && (@.value.type() == "array" && !exists(@.value[*] ? (@.type() == "null"))))) && exists($.keyvalue() ? (@.key == "bytes" && (@.value.type() != "null"))) && exists($.keyvalue() ? (@.key == "data")) && !exists($.keyvalue() ? (@.key != "blobs" && @.key != "bytes" && @.key != "data" && @.key != "notes"))') IS TRUE`,
      },
    ]);
  });

  it('requires a decimal member to be a JSON string, as the ORM writes it', () => {
    const amount = member(scalar('pg/numeric@1'));
    expect(render({ fields: { amount } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "amount" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "amount"))') IS TRUE`,
      },
    ]);
  });

  it('writes member names as jsonpath strings', () => {
    const quoted = member(scalar('pg/text@1'));
    expect(render({ fields: { 'say "hi"': quoted } })).toEqual([
      {
        kind: 'valueObject',
        expression: `jsonb_path_match("address", 'strict ${isObject} && exists($.keyvalue() ? (@.key == "say \\"hi\\"" && (@.value.type() == "string"))) && !exists($.keyvalue() ? (@.key != "say \\"hi\\""))') IS TRUE`,
      },
    ]);
  });
});
