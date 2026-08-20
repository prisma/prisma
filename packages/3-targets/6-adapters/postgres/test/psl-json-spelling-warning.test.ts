/**
 * PSL `Json` binds to the Postgres native "json" column type (`pg/json@1`),
 * but Prisma ORM's `Json` meant `jsonb` — a schema ported from Prisma 7
 * silently gets the wrong physical column type. The adapter's `Json` type
 * constructor declares a bare-spelling advisory, so lowering a bare `Json`
 * field warns at emit; `Jsonb` and explicit constructor calls stay silent,
 * and many hits batch into one grouped summary per build.
 */
import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import { buildSymbolTable } from '@internal/psl-parser';
import { parse } from '@internal/psl-parser/syntax';
import { interpretPslDocumentToSqlContract } from '@internal/sql-contract-psl';
import { postgresCreateNamespace } from '@internal/target-postgres/types';
import { describe, expect, it } from 'vitest';
import { useEmitWarningSpy } from '../../../../2-sql/1-core/contract/test/emit-warning-spy';
import { postgresAuthoringTypes } from '../src/core/control-mutation-defaults';

const JSON_WARNING_CODE = 'PN_PSL_JSON_NATIVE_JSON';

const postgresTarget = {
  kind: 'target' as const,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  id: 'postgres',
  version: '0.0.1',
  capabilities: {},
  defaultNamespaceId: 'public',
};

const scalarColumnDescriptors = collectScalarTypeConstructors(postgresAuthoringTypes);

function interpret(schema: string) {
  const { document, sourceFile } = parse(schema);
  const { table: symbolTable, diagnostics } = buildSymbolTable({
    document,
    sourceFile,
    pslBlockDescriptors: {},
  });
  expect(diagnostics).toEqual([]);
  return interpretPslDocumentToSqlContract({
    symbolTable,
    sourceFile,
    sourceId: 'schema.prisma',
    target: postgresTarget,
    scalarColumnDescriptors,
    authoringContributions: {
      entityTypes: {},
      field: {},
      type: postgresAuthoringTypes,
      valueObjectStorageType: 'Jsonb',
    },
    composedExtensionContracts: new Map(),
    createNamespace: postgresCreateNamespace,
    capabilities: { sql: { scalarList: true } },
  });
}

describe('bare Json spelling advisory on the postgres target', () => {
  const emitWarning = useEmitWarningSpy();

  function jsonWarningCalls() {
    return emitWarning().mock.calls.filter(
      ([, options]) => (options as { code?: string } | undefined)?.code === JSON_WARNING_CODE,
    );
  }

  it('a bare Json field warns at lowering, naming the field and the Jsonb fix', () => {
    const result = interpret(`model User {
  id Int @id
  data Json
}`);

    expect(result.ok).toBe(true);
    const calls = jsonWarningCalls();
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toBe(
      'field "User.data" is typed "Json", which binds to the Postgres native "json" column type. Prisma ORM\'s "Json" meant "jsonb" — write "Jsonb" to get a "jsonb" column.',
    );
  });

  it('Jsonb does not warn', () => {
    const result = interpret(`model User {
  id Int @id
  data Jsonb
}`);

    expect(result.ok).toBe(true);
    expect(jsonWarningCalls()).toEqual([]);
  });

  it('an explicit Json() constructor call does not warn', () => {
    const result = interpret(`model User {
  id Int @id
  data Json()
}`);

    expect(result.ok).toBe(true);
    expect(jsonWarningCalls()).toEqual([]);
  });

  it('a value-object field storing as Jsonb does not warn', () => {
    const result = interpret(`type Address {
  street String
}

model User {
  id Int @id
  address Address
}`);

    expect(result.ok).toBe(true);
    expect(jsonWarningCalls()).toEqual([]);
  });

  it('40 bare Json fields batch into ONE grouped warning listing every field', () => {
    const fields = Array.from({ length: 40 }, (_, i) => `  data${i} Json`).join('\n');
    const result = interpret(`model Blob {
  id Int @id
${fields}
}`);

    expect(result.ok).toBe(true);
    const calls = jsonWarningCalls();
    expect(calls).toHaveLength(1);
    const message = String(calls[0]?.[0]);
    expect(message).toMatch(
      /^40 fields are typed "Json", which binds to the Postgres native "json" column type\. Prisma ORM's "Json" meant "jsonb" — write "Jsonb" to get "jsonb" columns\./,
    );
    expect(message).toContain('  - field "Blob.data0"');
    expect(message).toContain('  - field "Blob.data39"');
  });
});
