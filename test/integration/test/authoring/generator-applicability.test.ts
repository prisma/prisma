import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import postgresAdapter from '@internal/adapter-postgres/control';
import sqliteAdapter from '@internal/adapter-sqlite/control';
import sql from '@internal/family-sql/control';
import { createControlStack } from '@internal/framework-components/control';
import { prismaContract } from '@internal/sql-contract-psl/provider';
import postgres from '@internal/target-postgres/control';
import postgresPackRef from '@internal/target-postgres/pack';
import { postgresCreateNamespace } from '@internal/target-postgres/types';
import sqlite, { sqliteCreateNamespace } from '@internal/target-sqlite/control';
import sqlitePackRef from '@internal/target-sqlite/pack';
import { join } from 'pathe';
import { afterAll, describe, expect, it } from 'vitest';

describe.each([
  {
    name: 'Postgres',
    stack: createControlStack({ family: sql, target: postgres, adapter: postgresAdapter }),
    pack: postgresPackRef,
    createNamespace: postgresCreateNamespace,
    char: 'Char(36)',
    varchar: 'VarChar(36)',
    integer: 'pg/int4',
  },
  {
    name: 'SQLite',
    stack: createControlStack({ family: sql, target: sqlite, adapter: sqliteAdapter }),
    pack: sqlitePackRef,
    createNamespace: sqliteCreateNamespace,
    char: 'uuidString()',
    varchar: 'sql.String(36)',
    integer: 'sqlite/integer',
  },
])(
  'generated defaults by column data type on $name',
  ({ stack, pack, createNamespace, char, varchar, integer }) => {
    const folders: string[] = [];
    afterAll(() => {
      for (const folder of folders) rmSync(folder, { recursive: true, force: true });
    });

    async function author(field: string) {
      const folder = mkdtempSync(join(tmpdir(), 'psl-generator-applicability-'));
      folders.push(folder);
      const schemaPath = join(folder, 'schema.prisma');
      writeFileSync(
        schemaPath,
        `// use prisma-8\n\nmodel Row {\n  id Int @id\n  value ${field}\n}\n`,
        'utf-8',
      );
      return prismaContract(schemaPath, { target: pack, createNamespace }).source.load({
        composedExtensions: [],
        defaultNamespaceId: stack.target.defaultNamespaceId,
        composedExtensionContracts: new Map(),
        authoringContributions: stack.authoringContributions,
        codecLookup: stack.codecLookup,
        dataTypes: stack.dataTypes,
        controlMutationDefaults: stack.controlMutationDefaults,
        resolvedInputs: [schemaPath],
        capabilities: stack.capabilities,
      });
    }

    it.each([
      ['String', 'uuid()', 'uuidv4'],
      ['String', 'nanoid()', 'nanoid'],
      ['String', 'cuid(2)', 'cuid2'],
      ['String', 'ulid()', 'ulid'],
      [char, 'uuid(7)', 'uuidv7'],
      [varchar, 'uuid()', 'uuidv4'],
    ])('takes %s @default(%s)', async (type, call, generator) => {
      const result = await author(`${type} @default(${call})`);
      if (!result.ok) throw new Error(JSON.stringify(result.failure.diagnostics));
      expect(result.value.execution?.mutations.defaults).toEqual([
        {
          ref: { namespace: stack.target.defaultNamespaceId, entry: 'Row', field: 'value' },
          onCreate: { kind: 'generator', id: generator },
        },
      ]);
    });

    it('refuses a generator on an Int column, naming its data type', async () => {
      const result = await author('Int @default(uuid())');
      expect(
        result.ok ? [] : result.failure.diagnostics.map(({ code, message }) => ({ code, message })),
      ).toEqual([
        {
          code: 'PSL_INVALID_DEFAULT_APPLICABILITY',
          message: `Default generator "uuidv4" is not applicable to "Row.value" with data type "${integer}".`,
        },
      ]);
    });
  },
);

describe('generated defaults on a Postgres uuid column', () => {
  it('takes Uuid @default(uuid())', async () => {
    const stack = createControlStack({ family: sql, target: postgres, adapter: postgresAdapter });
    const folder = mkdtempSync(join(tmpdir(), 'psl-generator-applicability-'));
    const schemaPath = join(folder, 'schema.prisma');
    writeFileSync(
      schemaPath,
      '// use prisma-8\n\nmodel Row {\n  id Uuid @id @default(uuid())\n}\n',
      'utf-8',
    );
    const result = await prismaContract(schemaPath, {
      target: postgresPackRef,
      createNamespace: postgresCreateNamespace,
    }).source.load({
      composedExtensions: [],
      defaultNamespaceId: stack.target.defaultNamespaceId,
      composedExtensionContracts: new Map(),
      authoringContributions: stack.authoringContributions,
      codecLookup: stack.codecLookup,
      dataTypes: stack.dataTypes,
      controlMutationDefaults: stack.controlMutationDefaults,
      resolvedInputs: [schemaPath],
      capabilities: stack.capabilities,
    });
    rmSync(folder, { recursive: true, force: true });
    if (!result.ok) throw new Error(JSON.stringify(result.failure.diagnostics));
    expect(result.value.execution?.mutations.defaults).toEqual([
      {
        ref: { namespace: 'public', entry: 'Row', field: 'id' },
        onCreate: { kind: 'generator', id: 'uuidv4' },
      },
    ]);
  });
});
