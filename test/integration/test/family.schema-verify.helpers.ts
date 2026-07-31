/**
 * Shared helpers for family.schema-verify tests.
 */
import postgresAdapter from '@prisma-next/adapter-postgres/control';
import type { Contract } from '@prisma-next/contract/types';
import postgresDriver from '@prisma-next/driver-postgres/control';
import sql, { type SqlControlFamilyInstance } from '@prisma-next/family-sql/control';
import type { TargetBoundComponentDescriptor } from '@prisma-next/framework-components/components';
import type { ControlExtensionDescriptor } from '@prisma-next/framework-components/control';
import { createControlStack } from '@prisma-next/framework-components/control';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import postgres from '@prisma-next/target-postgres/control';
import { PostgresContractSerializer } from '@prisma-next/target-postgres/runtime';
import { createDevDatabase, timeouts, withClient } from '@repo/test-utils';
import { beforeAll } from 'vitest';

// Re-export common imports for test files
export { int4Column, textColumn } from '@prisma-next/adapter-postgres/column-types';
export { defineContract, field, model, rel } from '@prisma-next/postgres/contract-builder';
export type { CodecTypes } from '@prisma-next/target-postgres/codec-types';
export { pgvector } from './family.schema-verify.extensions';
export type { Contract, SqlStorage };
export {
  PostgresContractSerializer,
  postgres,
  postgresAdapter,
  postgresDriver,
  sql,
  timeouts,
  withClient,
};

/**
 * Sets up a shared dev database for schema verification tests.
 * Call this in a beforeAll hook at the top of your describe block.
 *
 * @returns Object with connectionString getter
 */
export function useDevDatabase(): { getConnectionString: () => string } {
  let connectionString: string | undefined;

  beforeAll(async () => {
    const database = await createDevDatabase();
    connectionString = database.connectionString;
    return async () => {
      await database.close();
    };
  }, timeouts.spinUpPpgDev);

  return {
    getConnectionString: () => {
      if (!connectionString) {
        throw new Error('Connection string not set');
      }
      return connectionString;
    },
  };
}

/**
 * Creates a SQL control-plane family instance for testing.
 */
export function createFamilyInstance(
  extensions: readonly ControlExtensionDescriptor<'sql', 'postgres'>[] = [],
): SqlControlFamilyInstance {
  return sql.create(
    createControlStack({
      family: sql,
      target: postgres,
      adapter: postgresAdapter,
      driver: postgresDriver,
      extensions: extensions,
    }),
  );
}

/**
 * Creates a driver and runs a test callback, ensuring cleanup.
 */
export async function withDriver<T>(
  connectionString: string,
  callback: (driver: Awaited<ReturnType<typeof postgresDriver.create>>) => Promise<T>,
): Promise<T> {
  const driver = await postgresDriver.create(connectionString);
  try {
    return await callback(driver);
  } finally {
    await driver.close();
  }
}

/**
 * Introspects the live schema and verifies it against the contract.
 */
export async function runSchemaVerify(
  connectionString: string,
  contract: unknown,
  options: {
    strict?: boolean;
    extensions?: readonly ControlExtensionDescriptor<'sql', 'postgres'>[];
  } = {},
) {
  return withDriver(connectionString, async (driver) => {
    const familyInstance = createFamilyInstance(options.extensions);
    const validatedContract = new PostgresContractSerializer().deserializeContract(
      contract,
    ) as Contract<SqlStorage>;
    const frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', 'postgres'>> = [
      postgres,
      postgresAdapter,
      ...(options.extensions ?? []),
    ];
    const schema = await familyInstance.introspect({ driver, contract: validatedContract });
    return familyInstance.verifySchema({
      contract: validatedContract,
      schema,
      strict: options.strict ?? false,
      frameworkComponents,
    });
  });
}
