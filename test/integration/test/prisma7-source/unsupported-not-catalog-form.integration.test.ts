/**
 * Prisma 7 writes an `Unsupported("...")` text into DDL as given, and Postgres stores the type
 * under its catalog name. The Prisma 7 source reads the text as written, so `db verify` reports a
 * text that is not in catalog form with the text the database reports (ADR 273).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgresAdapter from '@internal/adapter-postgres/control';
import type { Contract } from '@internal/contract/types';
import postgresDriver from '@internal/driver-postgres/control';
import sql from '@internal/family-sql/control';
import { createControlStack } from '@internal/framework-components/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { prisma7Contract } from '@internal/sql-contract-prisma7/provider';
import postgres from '@internal/target-postgres/control';
import { prisma7PostgresBinding } from '@internal/target-postgres/prisma7-binding';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { withClient } from '@repo/test-utils';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { runSchemaVerify, timeouts, useDevDatabase } from '../family.schema-verify.helpers';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/prisma7-source/unsupported-not-catalog-form',
);

describe('an Unsupported text not in catalog form', () => {
  const { getConnectionString } = useDevDatabase();

  it(
    'loads, and db verify reports the text the database reports',
    async () => {
      await withClient(getConnectionString(), async (client) => {
        await client.query('DROP TABLE IF EXISTS "Legacy"');
        await client.query(readFileSync(join(fixtureDir, 'migration.sql'), 'utf8'));
      });
      const schemaPath = join(fixtureDir, 'schema.prisma');
      const stack = createControlStack({
        family: sql,
        target: postgres,
        adapter: postgresAdapter,
        driver: postgresDriver,
        extensions: [],
      });
      const loaded = await prisma7Contract(schemaPath, {
        binding: prisma7PostgresBinding,
      }).source.load({
        composedExtensions: [],
        defaultNamespaceId: stack.target.defaultNamespaceId,
        composedExtensionContracts: stack.extensionContracts,
        authoringContributions: stack.authoringContributions,
        codecLookup: stack.codecLookup,
        dataTypes: stack.dataTypes,
        controlMutationDefaults: stack.controlMutationDefaults,
        resolvedInputs: [schemaPath],
        capabilities: stack.capabilities,
      });
      if (!loaded.ok) throw new Error(JSON.stringify(loaded.failure.diagnostics));

      const verified = await runSchemaVerify(
        getConnectionString(),
        new PostgresContractSerializer().serializeContract(loaded.value as Contract<SqlStorage>),
      );

      expect(
        verified.schema.issues.map((issue) => ({
          path: issue.path,
          explanation: issue.explanation?.text,
        })),
      ).toEqual([
        {
          path: ['database', 'public', 'Legacy', 'column:code'],
          explanation:
            'The column type is "INT4", but the database reports "integer". A type named by its catalog text is compared with the text the database reports, exactly.',
        },
        {
          path: ['database', 'public', 'Legacy', 'column:name'],
          explanation:
            'The column type is "varchar(10)", but the database reports "character varying(10)". A type named by its catalog text is compared with the text the database reports, exactly.',
        },
      ]);
    },
    timeouts.spinUpPpgDev,
  );
});
