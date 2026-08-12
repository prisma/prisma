import { createDbUpdateCommand } from '@internal/cli/commands/db-update';
import { ifDefined } from '@internal/utils/defined';
import type { setupTestDirectoryFromFixtures } from './cli-test-helpers';
import { executeCommand, getExitCode, setupDbTestFixture } from './cli-test-helpers';

export type DbUpdateTestSetup = ReturnType<typeof setupTestDirectoryFromFixtures>;

export async function setupDbUpdateFixture(
  connectionString: string,
  createTempDir: () => string,
  fixtureSubdir: string,
  schemaSql?: string,
): Promise<{ testSetup: DbUpdateTestSetup; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir,
    ...ifDefined('schemaSql', schemaSql),
  });
}

export async function runDbUpdate(
  testSetup: DbUpdateTestSetup,
  args: readonly string[],
): Promise<number> {
  const command = createDbUpdateCommand();
  const originalCwd = process.cwd();
  try {
    process.chdir(testSetup.testDir);
    return await executeCommand(command, [...args]);
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Runs db update and returns the exit code without re-throwing on failure.
 * Use this for tests that expect the command to fail (e.g., missing marker, planning conflicts).
 */
export async function runDbUpdateAllowFailure(
  testSetup: DbUpdateTestSetup,
  args: readonly string[],
): Promise<number> {
  const command = createDbUpdateCommand();
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
