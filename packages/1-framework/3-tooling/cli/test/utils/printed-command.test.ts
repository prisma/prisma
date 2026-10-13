import { describe, expect, it } from 'vitest';
import { selfEmitCommand } from '../../src/utils/printed-command';

describe('selfEmitCommand', () => {
  it('names the migration.ts relative to where the CLI ran, with the --config it was given', () => {
    expect(
      selfEmitCommand(
        { cwd: '/work', configPath: 'my app/prisma.config.ts', dbGiven: true },
        '/work/my app/migrations/app/20261013T1200_age/migration.ts',
      ),
    ).toBe(
      "node 'my app/migrations/app/20261013T1200_age/migration.ts' --config 'my app/prisma.config.ts'",
    );
  });
});
