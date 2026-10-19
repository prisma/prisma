import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function patternsOf(audience: 'app' | 'extension', id: string): readonly RegExp[] {
  const guide = readFileSync(
    join(
      repoRoot,
      'upgrade-instructions/pending/more-codecs-refused-for-enums',
      audience,
      'instructions.md',
    ),
    'utf-8',
  );
  const block = guide.split(/\n {2}- id: /).find((candidate) => candidate.startsWith(`${id}\n`));
  if (block === undefined) throw new Error(`no change ${id}`);
  return [...block.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

const detects = (patterns: readonly RegExp[], source: string) =>
  patterns.some((pattern) => pattern.test(source));

describe('more-codecs-refused-for-enums detection', () => {
  const patterns = patternsOf('app', 'more-codecs-refused-for-enums');

  it.each([
    ['a PSL jsonb enum', 'enum Payload {\n  @@type("pg/jsonb@1")\n  Low = "low"\n}'],
    ['a PSL timetz enum', 'enum At {\n  @@type( "pg/timetz@1" )\n  Noon = "12:00:00Z"\n}'],
    ['a PSL geometry enum', 'enum Shape {\n  @@type("pg/geometry@1")\n}'],
    [
      'a TypeScript enum on the timetz helper',
      "const At = enumType('At', timetzColumn(), member('Noon', '12:00:00Z'));",
    ],
    [
      'a TypeScript enum on the timetz helper with a precision',
      "const At = enumType('At', timetzColumn(3), member('Noon', '12:00:00Z'));",
    ],
    [
      'a TypeScript enum on the jsonb helper',
      "const P = enumType('P', jsonbColumn, member('Low', 'low'));",
    ],
    [
      'a TypeScript enum on a quoted codec id',
      "const P = enumType('P', { codecId: 'pg/jsonb@1' }, member('Low', 'low'));",
    ],
    [
      'a TypeScript enum on a backtick-quoted codec id',
      'const P = enumType(`P`, { codecId: `pg/timetz@1` }, member(`Low`, `low`));',
    ],
    [
      'a TypeScript enum on the arktype json helper',
      "const P = enumType('P', arktypeJson(schema), member('Low', 'low'));",
    ],
    [
      'a TypeScript enum on the vector helper',
      "const P = enumType('P', vector(3), member('Low', [1, 2, 3]));",
    ],
    [
      'a TypeScript enum on the native enum codec',
      "const P = enumType('P', { codecId: \"pg/enum@1\" }, member('Low', 'low'));",
    ],
  ])('finds %s', (_name, source) => {
    expect(detects(patterns, source)).toBe(true);
  });

  it.each([
    ['a PSL text enum', 'enum Level {\n  @@type("pg/text@1")\n  Low = "low"\n}'],
    ['a PSL json enum, refused by an earlier release', 'enum Payload {\n  @@type("pg/json@1")\n}'],
    ['a codec id of another version', 'enum Payload {\n  @@type("pg/jsonb@2")\n}'],
    ['a codec id with a longer name', 'enum At {\n  @@type("pg/timetz-x@1")\n}'],
    [
      'a jsonb column in a file with no enum',
      'const User = model({ fields: { meta: field.column(jsonbColumn) } });',
    ],
    [
      'a generated file',
      "// GENERATED FILE - DO NOT EDIT\nconst P = enumType('P', jsonbColumn, member('Low', 'low'));",
    ],
    ['a TypeScript text enum', "const P = enumType('P', textColumn, member('Low', 'low'));"],
    [
      'a name that ends in vector',
      "const P = enumType('P', textColumn, member('Low', myvector('low')));",
    ],
  ])('skips %s', (_name, source) => {
    expect(detects(patterns, source)).toBe(false);
  });
});

describe('adapted-family-codecs-render-literals-from-target-options detection', () => {
  const patterns = patternsOf(
    'extension',
    'adapted-family-codecs-render-literals-from-target-options',
  );

  it('finds a codec a target or extension adapts from a family template', () => {
    expect(
      [
        'export const d = postgresCodec(sqlTextDescriptor, { dataType: pgText });',
        'export const d = sqliteCodec(sqlTextDescriptor, { dataType: sqliteText });',
      ].map((source) => detects(patterns, source)),
    ).toEqual([true, true]);
  });

  it('skips a codec descriptor class and other names', () => {
    expect(
      [
        'export class MyDescriptor extends PostgresCodecDescriptor<void> {}',
        'const x = myPostgresCodec(template);',
      ].map((source) => detects(patterns, source)),
    ).toEqual([false, false]);
  });
});
