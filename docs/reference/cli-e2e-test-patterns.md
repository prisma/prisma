# CLI E2E Test Fixture Patterns

## Overview

CLI e2e tests use a shared fixture app pattern to ensure proper module resolution and reduce duplication. This pattern creates isolated test environments that can load config files with workspace dependencies.

## Test Types: In-Process vs Subprocess

There are two approaches to CLI testing:

### In-Process Tests (Current `test/integration/*.e2e.test.ts`)

- Import command factories directly (e.g., `createDbInitCommand()`)
- Mock `process.exit` and `console.log` to capture output
- Run commands via `command.parseAsync()` in the same Node process
- **Pros**: Faster, easier to mock database connections
- **Cons**: Not truly E2E (doesn't test CLI entrypoint, shebang, ESM/CJS interop)

### Subprocess Tests (True E2E, e.g., `cli.emit-cli-process.e2e.test.ts`)

- Spawn the CLI as a separate Node process using `execFileAsync('node', [cliPath, ...])`
- Test the actual built CLI binary (`dist/cli.js`)
- **Pros**: Tests real CLI behavior, catches ESM/CJS issues
- **Cons**: Slower, requires build first, harder to mock

**Recommendation**: Use in-process tests for fast iteration during development, but add subprocess tests for critical CLI flows.

## Structure

**Shared fixture app directory:**
```
packages/framework/tooling/cli/test/cli-e2e-test-app/
  package.json          # Static, for pnpm install (dependencies must be installed)
  fixtures/
    {command}/          # Fixtures organized by command
      contract.ts
      prisma-next.config.ts
      prisma-next.config.{variant}.ts
```

**Test execution:**
- Each test creates an ephemeral directory (e.g., `test-1234567890-abc123/`)
- Files are copied from the fixture subdirectory to the ephemeral directory
- Test directories are subdirectories of the fixture app and inherit workspace dependencies from the parent `package.json` at the root
- Tests run commands from within the ephemeral directory

## Pattern

**✅ CORRECT: Use shared fixture app with command-specific subdirectories**

```typescript
import { withTempDir, setupTestDirectoryFromFixtures } from './utils/test-helpers';

// Fixture subdirectory for this command's tests
const fixtureSubdir = 'emit';

withTempDir(({ createTempDir }) => {
  describe('command e2e tests', () => {
    it('test description', async () => {
      // Set up test directory from fixtures
      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        fixtureSubdir,
        'prisma-next.config.emit.ts', // Config file name
        { '{{PLACEHOLDER}}': 'value' }, // Optional replacements
      );
      const testDir = testSetup.testDir;
      const configPath = testSetup.configPath;

      // Run command from testDir
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
```

## Helper Function

**`setupTestDirectoryFromFixtures(createTempDir: () => string, fixtureSubdir, configFileName?, replacements?)`**

- **`createTempDir`**: Required. Function that returns a new ephemeral test directory path.
- **`fixtureSubdir`**: Name of the fixture subdirectory (e.g., `'emit'`, `'db-verify'`)
- **`configFileName`**: Optional. Name of the config file to copy (defaults to `'prisma-next.config.ts'`)
- **`replacements`**: Optional. Object mapping placeholders to values (e.g., `{ '{{DB_URL}}': connectionString }`)

**Returns:**
- `testDir`: Path to the ephemeral test directory
- `contractPath`: Path to the copied `contract.ts` file
- `outputDir`: Path to the `output/` subdirectory
- `configPath`: Path to the copied config file

**Note**: If you need a cleanup function, use `setupIntegrationTestDirectoryFromFixtures(...)` instead (it returns `{ ..., cleanup }`).

## Key Points

1. **Static `package.json`**: The `package.json` at the root of `cli-e2e-test-app` must have dependencies installed via `pnpm install`. This ensures workspace packages can be resolved when loading config files.

2. **No package.json in test directories**: Test directories are subdirectories of the fixture app and inherit workspace dependencies from the parent `package.json` at the root. jiti will resolve workspace packages by walking up to find the parent `package.json`. This avoids pnpm workspace conflicts when multiple test directories exist.

3. **Fixture organization**: Organize fixtures by command in subdirectories. This keeps related fixtures together and makes it easy to find command-specific configs.

4. **Placeholder replacement**: Use placeholders like `{{DB_URL}}` in fixture configs and replace them at test time. This allows tests to inject dynamic values (e.g., database connection strings).

5. **Ephemeral directories**: Each test gets its own directory, ensuring isolation. Each test must clean up its own directory.

6. **Cleanup responsibility**: Prefer `withTempDir(...)` for per-test cleanup (it tracks directories and removes them in `afterEach`). If you need an explicit cleanup function, use `setupIntegrationTestDirectoryFromFixtures(...)`. **Never use `afterAll` hooks for cleanup** - they can interfere with tests that are still running and cause race conditions. **Never use global cleanup functions** that scan and delete directories - this causes race conditions when tests run in parallel.

7. **Module resolution**: Tests run from within the ephemeral directory, which is a subdirectory of the fixture app. Node's module resolution walks up to find the parent `package.json` and `node_modules`, allowing workspace packages to be resolved correctly.

## When to Use

- ✅ CLI e2e tests that need to load config files
- ✅ Tests that need to verify command behavior with different config variants
- ✅ Tests that need isolated environments per test case

## When NOT to Use

- ❌ Unit tests (use mocks instead)
- ❌ Integration tests that don't need config file loading
- ❌ Tests that don't need workspace package resolution

## Examples

**Multiple config variants:**
```
fixtures/db-verify/
  contract.ts
  prisma-next.config.ts                    # Basic config
  prisma-next.config.with-db.ts           # Config with database
  prisma-next.config.no-driver.ts         # Config missing driver
  prisma-next.config.no-verify.ts         # Config missing verify.readMarkerSql
```

**Using placeholders:**
```typescript
withTempDir(({ createTempDir }) => {
  const testSetup = setupTestDirectoryFromFixtures(
    createTempDir,
    'db-verify',
    'prisma-next.config.with-db.ts',
    { '{{DB_URL}}': connectionString },
  );

  // ... test code ...
});
```

**Using afterEach for cleanup:**
```typescript
withTempDir(({ createTempDir }) => {
  describe('command tests', () => {
    let testSetup: ReturnType<typeof setupTestDirectoryFromFixtures>;

    beforeEach(() => {
      testSetup = setupTestDirectoryFromFixtures(createTempDir, fixtureSubdir);
    });

    it('test description', async () => {
      // ... test code using testSetup.testDir ...
    });
  });
});
```

## Testing CLI as Separate Process

For tests that need to run the CLI as a separate Node.js process (e.g., to test the built CLI binary), use `execFileAsync` with the `cwd` option:

**✅ CORRECT: Use `execFileAsync` with `cwd` option**

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setupIntegrationTestDirectoryFromFixtures } from './utils/test-helpers';

const execFileAsync = promisify(execFile);

describe('CLI process e2e', () => {
  it('executes CLI as separate process', async () => {
    const testSetup = setupIntegrationTestDirectoryFromFixtures('emit-command');
    const { testDir, cleanup } = testSetup;
    const cliPath = resolve(__dirname, '../dist/cli.js');

    try {
      // Set cwd for spawned process so relative paths in config resolve correctly
      await execFileAsync(
        'node',
        [cliPath, 'contract', 'emit', '--config', 'prisma-next.config.ts'],
        {
          cwd: testDir, // Set working directory for spawned process
        },
      );
    } catch (error: unknown) {
      // Only log output on errors for debugging
      if (error && typeof error === 'object' && 'stderr' in error) {
        console.error('CLI stderr:', error.stderr);
      }
      if (error && typeof error === 'object' && 'stdout' in error) {
        console.log('CLI stdout:', error.stdout);
      }
      throw error;
    } finally {
      cleanup();
    }
  });
});
```

**Key points:**
- Use `execFileAsync` (promisified `execFile`) to run CLI as separate process
- Always set `cwd` option to `testDir` so relative paths in config files resolve correctly
- `execFile` captures stdout/stderr by default - no need for `stdio` option (that's for `spawn`)
- Output files are written to the temp test directory and cleaned up automatically
- Use `setupIntegrationTestDirectoryFromFixtures` for tests that need package resolution (e.g., `loadContractFromTs`)

**❌ WRONG: Don't use `stdio` option with `execFile`**

```typescript
// ❌ WRONG: execFile doesn't support stdio option (that's for spawn)
await execFileAsync('node', [cliPath, 'emit'], {
  stdio: 'pipe', // Type error: stdio doesn't exist on ExecFileOptions
  cwd: testDir,
});
```

**Why?**
- `execFile` doesn't support `stdio` option - that's for `spawn`
- `execFile` captures stdout/stderr by default in the result object
- Only log output on errors for cleaner test output

## Commander.js Argument Parsing in Test Helpers

**CRITICAL**: When using Commander's `parseAsync()` in test helpers, you must use `{ from: 'user' }` to tell Commander that the arguments are user-supplied.

**✅ CORRECT: Use `{ from: 'user' }` option**

```typescript
export async function executeCommand(command: Command, args: string[]): Promise<number> {
  try {
    // Use { from: 'user' } to tell Commander these are user args, not process.argv format
    // process.argv format would be ['node', 'script.js', '--option', 'value']
    await command.parseAsync(args, { from: 'user' });
    return 0;
  } catch (error) {
    // ... error handling ...
  }
}
```

**❌ WRONG: Passing args without `{ from: 'user' }`**

```typescript
// ❌ WRONG: Commander interprets first two args as 'node' and 'script.js'
await command.parseAsync(args);  // '--config' and 'file.ts' are silently ignored!

// ❌ WRONG: Prepending 'node' and 'cli.js' to simulate process.argv
await command.parseAsync(['node', 'cli.js', ...args]);  // Works but verbose
```

**Why?**
- Without `{ from: 'user' }`, Commander assumes `process.argv` format where first two elements are `node` executable and script path
- This causes user arguments like `['--config', 'file.ts']` to be treated as the node/script path, not as options
- Arguments are silently ignored, making tests pass when they shouldn't
- Using `{ from: 'user' }` tells Commander to treat all provided args as user-supplied options

**See also:** `packages/framework/tooling/cli/test/utils/test-helpers.ts` for the `executeCommand` implementation.

## Related Patterns

- `docs/Testing Guide.md`: General testing patterns
- `docs/reference/test-import-patterns.md`: Test import patterns
- `packages/framework/tooling/cli/test/utils/test-helpers.ts`: Implementation of `setupTestDirectoryFromFixtures` and `setupIntegrationTestDirectoryFromFixtures`
