import { createDbInitCommand } from '@internal/cli/commands/db-init';
import { ifDefined } from '@internal/utils/defined';
import type { setupTestDirectoryFromFixtures } from './cli-test-helpers';
import { executeCommand, getExitCode, setupDbTestFixture } from './cli-test-helpers';

export type DbInitTestSetup = ReturnType<typeof setupTestDirectoryFromFixtures>;

export async function setupDbInitFixture(
  connectionString: string,
  createTempDir: () => string,
  fixtureSubdir: string,
  schemaSql?: string,
): Promise<{ testSetup: DbInitTestSetup; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir,
    ...ifDefined('schemaSql', schemaSql),
  });
}

export async function runDbInit(
  testSetup: DbInitTestSetup,
  args: readonly string[],
): Promise<number> {
  const command = createDbInitCommand();
  const originalCwd = process.cwd();
  try {
    process.chdir(testSetup.testDir);
    return await executeCommand(command, [...args]);
  } finally {
    process.chdir(originalCwd);
  }
}

export async function runDbInitAllowFailure(
  testSetup: DbInitTestSetup,
  args: readonly string[],
): Promise<number> {
  const command = createDbInitCommand();
  const originalCwd = process.cwd();
  try {
    process.chdir(testSetup.testDir);
    return await executeCommand(command, [...args]);
  } catch {
    return getExitCode() ?? 1;
  } finally {
    process.chdir(originalCwd);
  }
}
