/**
 * Config File Errors (Journey T)
 *
 * Verifies that contract emit fails gracefully for broken configuration:
 * missing config file, explicit nonexistent path, invalid TypeScript syntax,
 * and a config that compiles but is missing the contract field. No database
 * needed.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import { runContractEmitWithConfig, setupJourney } from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Journey T: Config Errors', () => {
    // T.01: contract emit with no config file
    it(
      'T.01: fails when config file does not exist',
      async () => {
        const ctx = setupJourney({ createTempDir });

        // Remove the config file to simulate missing config
        const result = await runContractEmitWithConfig(
          ctx.testDir,
          join(ctx.testDir, 'nonexistent-config.ts'),
        );
        expect(result.exitCode, 'T.01: missing config').not.toBe(0);
      },
      timeouts.typeScriptCompilation,
    );

    // T.02: contract emit --config ./nonexistent.ts
    it(
      'T.02: fails when explicit config path does not exist',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const result = await runContractEmitWithConfig(ctx.testDir, './this-does-not-exist.ts');
        expect(result.exitCode, 'T.02: explicit missing config').not.toBe(0);
      },
      timeouts.typeScriptCompilation,
    );

    // T.03: contract emit with invalid TS in config
    it(
      'T.03: fails when config has invalid TypeScript',
      async () => {
        const ctx = setupJourney({ createTempDir });

        // Overwrite config with invalid TS
        const invalidConfigPath = join(ctx.testDir, 'prisma-next.config.ts');
        writeFileSync(invalidConfigPath, 'export default {{{INVALID SYNTAX', 'utf-8');

        const result = await runContractEmitWithConfig(ctx.testDir, invalidConfigPath);
        expect(result.exitCode, 'T.03: invalid config TS').not.toBe(0);
      },
      timeouts.typeScriptCompilation,
    );

    // T.04: contract emit with config missing contract field
    it(
      'T.04: fails when config is missing contract configuration',
      async () => {
        const ctx = setupJourney({ createTempDir });

        // Overwrite config with valid TS but missing contract field
        const emptyConfigPath = join(ctx.testDir, 'prisma-next.config.ts');
        writeFileSync(
          emptyConfigPath,
          `
import { defineConfig } from '@prisma/orm-toolchain/cli/config-types';
import sql from '@prisma/orm-postgres/family/control';
import postgres from '@prisma/orm-postgres/target/control';
import postgresAdapter from '@prisma/orm-postgres/adapter/control';

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  extensions: [],
} as any);
`,
          'utf-8',
        );

        const result = await runContractEmitWithConfig(ctx.testDir, emptyConfigPath);
        expect(result.exitCode, 'T.04: missing contract field').not.toBe(0);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
