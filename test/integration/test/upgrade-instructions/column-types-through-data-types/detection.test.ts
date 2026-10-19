import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function detectionOf(audience: 'app' | 'extension', id: string): readonly RegExp[] {
  const guide = readFileSync(
    join(
      repoRoot,
      'upgrade-instructions/pending/column-types-through-data-types',
      audience,
      'instructions.md',
    ),
    'utf-8',
  );
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The ${audience} fragment has no change ${id}`);
  return [...entry.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

function detects(audience: 'app' | 'extension', id: string, content: string): boolean {
  return detectionOf(audience, id).some((pattern) => pattern.test(content));
}

describe('extension detection', () => {
  it.each([
    [
      'type-lookups-one-framework-type',
      'function storageTypeOf(codecId: string, lookups: SqlTypeLookups) {}',
      'const lookups = testSqlTypeLookups();',
    ],
    [
      'type-lookups-one-framework-type',
      'function f(lookups: MongoTypeLookups) {}',
      'const mongoTypeLookups = {};',
    ],
    [
      'type-name-normalisers-removed',
      'normalizeSchemaNativeType(column.type)',
      'normalizeSchemaNativeTypes(column.type)',
    ],
    [
      'type-name-normalisers-removed',
      'normalizeSqliteNativeType(column.type)',
      'readSqliteDefault(raw, type)',
    ],
    [
      'introspected-type-text',
      'const { nativeType, many } = introspectedNativeType(row);',
      'const { typeText, many } = introspectedTypeText(row);',
    ],
    [
      'introspected-type-text',
      'const row: CatalogColumnType = { dataType: "text" };',
      'const row: CatalogColumn = { dataType: "text" };',
    ],
    [
      'schema-ir-column-type-text',
      "new SqlColumnIR({ name: 'id', nativeType: 'int4', nullable: false });",
      "new SqlColumnIR({ name: 'id', typeText: 'int4', nullable: false });",
    ],
    [
      'schema-ir-column-type-text',
      'column.resolvedNativeType === other.resolvedNativeType',
      'column.typeText === other.typeText',
    ],
    [
      'default-resolver-takes-the-column',
      'readPostgresDefault(raw, "text[]")',
      'readSqliteDefault(raw, "text")',
    ],
    [
      'default-resolver-takes-the-column',
      'const resolve: DefaultResolver = (def, nativeType) => def;',
      'const resolve: DefaultReader = (def) => def;',
    ],
    [
      'alter-type-postcheck-by-data-type',
      "const text = buildExpectedFormatType({ codecId: 'pg/int4@1' }, types);",
      "const check = alterTypeCheck('int4', dataTypes, where);",
    ],
    [
      'alter-type-postcheck-by-data-type',
      "alterTypeCheckText('int4', dataTypes, where)",
      "alterTypeCheck('int4', dataTypes, where)",
    ],
  ])('%s finds the old use and skips the new one', (id, before, after) => {
    expect({
      before: detects('extension', id, before),
      after: detects('extension', id, after),
    }).toEqual({ before: true, after: false });
  });

  it('skips nativeType in a file that names no schema IR column, such as a Prisma 7 type table', () => {
    expect(
      detects(
        'extension',
        'schema-ir-column-type-text',
        "const map = { nativeTypes: { VarChar: { nativeType: 'varchar' } } };",
      ),
    ).toBe(false);
  });
});

describe('app detection', () => {
  it('finds a script that reads nativeType from db schema --json', () => {
    expect(
      detects(
        'app',
        'db-schema-json-names-type-text',
        "prisma db schema --json | jq '.schema.tables[].columns[].nativeType'",
      ),
    ).toBe(true);
  });

  it('skips a script that reads typeText, and nativeType unrelated to db schema', () => {
    expect({
      typeText: detects(
        'app',
        'db-schema-json-names-type-text',
        "prisma db schema --json | jq '.schema.tables[].columns[].typeText'",
      ),
      unrelated: detects('app', 'db-schema-json-names-type-text', 'const nativeType = "int4";'),
    }).toEqual({ typeText: false, unrelated: false });
  });
});
