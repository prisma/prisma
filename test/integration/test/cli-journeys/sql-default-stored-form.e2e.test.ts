/**
 * A raw SQL default the database stores in its own form. `db migrate` applies
 * `now() - interval '1 day'`, which Postgres stores as `(now() - '1 day'::interval)`, so the check
 * after apply fails and its why says what the database stores and what to write. The contract
 * changed to the stored text then migrates and verifies clean.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  planMigrationAndSelfEmit,
  runContractEmit,
  runDbVerify,
  runMigrate,
  setupJourney,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

const WRITTEN = "now() - interval '1 day'";
const STORED = "(now() - '1 day'::interval)";

function schemaWithDefault(expression: string): string {
  return `// use prisma-8

model Event {
  id Int      @id
  at DateTime @default(sql\`${expression}\`)
}
`;
}

withTempDir(({ createTempDir }) => {
  describe('a raw SQL default the database stores in its own form', () => {
    const db = useDevDatabase();

    it(
      'db migrate names the stored form; the contract changed to it migrates and verifies clean',
      async () => {
        const ctx = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });
        const contractPath = join(ctx.testDir, 'contract.prisma');
        writeFileSync(contractPath, schemaWithDefault(WRITTEN));

        expect((await runContractEmit(ctx)).exitCode).toBe(0);
        expect((await planMigrationAndSelfEmit(ctx, ['--name', 'initial'])).exitCode).toBe(0);
        const failed = await runMigrate(ctx);
        const shown = stripAnsi(`${failed.stderr}\n${failed.stdout}`);
        expect(failed.exitCode, shown).not.toBe(0);
        expect(shown).toContain(
          `The live schema differs: mismatch: database/public/Event/column:at/default. The database stores this default as \`${STORED}\`; the contract declares \`${WRITTEN}\`. The database may store a default expression in its own form, so the two can mean the same. If they do, change the default's SQL in the contract to \`${STORED}\`.`,
        );

        writeFileSync(contractPath, schemaWithDefault(STORED));
        rmSync(join(ctx.testDir, ctx.migrationsDir ?? 'migrations'), {
          recursive: true,
          force: true,
        });
        expect((await runContractEmit(ctx)).exitCode).toBe(0);
        expect((await planMigrationAndSelfEmit(ctx, ['--name', 'initial'])).exitCode).toBe(0);
        const applied = await runMigrate(ctx);
        expect(applied.exitCode, stripAnsi(applied.stderr)).toBe(0);
        const verified = await runDbVerify(ctx);
        expect(verified.exitCode, stripAnsi(verified.stderr)).toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
