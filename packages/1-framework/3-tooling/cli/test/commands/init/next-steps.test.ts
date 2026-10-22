import { describe, expect, it } from 'vitest';
import { buildNextSteps } from '../../../src/commands/init/output';

const inputs = {
  target: 'postgres',
  packagesInstalled: 'installed',
  contractEmitted: true,
  emitCommand: 'prisma contract emit',
  schemaPath: 'src/prisma/contract.prisma',
  prisma7: null,
} as const;

describe('init next steps', () => {
  it('offers a temporary database and deployment before the agent skills for postgres', () => {
    const steps = buildNextSteps(inputs);

    expect(steps[0]).toBe(
      '1. Set DATABASE_URL in your environment (export it or add it to .env). No database yet? `npx create-db@latest` creates a temporary Prisma Postgres database and prints its URL; it is deleted after 24 hours unless you claim it.',
    );
    expect(steps.at(-2)).toBe(
      '4. To host the app: `prisma deploy module.ts` deploys a Prisma Composer (Early Access) app to Prisma Compute after `prisma auth login` and a build. The first deploy also needs a region (`PRISMA_REGION` or the deploy config): https://www.prisma.io/docs/compute/getting-started',
    );
    expect(steps.at(-1)).toBe(
      '5. Working with a coding agent? Run `prisma init` in this project to set up the Prisma agent skills.',
    );
  });

  it('keeps the dependency install first when packages are skipped', () => {
    const steps = buildNextSteps({
      ...inputs,
      packagesInstalled: 'skipped',
      contractEmitted: false,
    });

    expect(steps[0]).toBe(
      '1. Install the project dependencies with your package manager (this run skipped them).',
    );
    expect(steps[1]).toContain('DATABASE_URL');
    expect(steps[1]).toContain('npx create-db@latest');
    expect(steps[2]).toBe('3. Emit the contract: `prisma contract emit`');
  });

  it('keeps the MongoDB steps unchanged', () => {
    expect(buildNextSteps({ ...inputs, target: 'mongodb', contractEmitted: false })).toEqual([
      '1. Set DATABASE_URL in your environment (export it or add it to .env).',
      '2. Emit the contract: `prisma contract emit`',
      '3. Edit your schema at src/prisma/contract.prisma, then re-run the emit command.',
      '4. Open prisma-8.md for a quick reference on how to write your first typed query.',
      '5. Working with a coding agent? Run `prisma init` in this project to set up the Prisma agent skills.',
    ]);
  });

  it('keeps the Prisma 7 steps unchanged', () => {
    expect(
      buildNextSteps({
        ...inputs,
        packagesInstalled: 'skipped',
        contractEmitted: false,
        prisma7: { packagesMoved: ['@prisma/prisma7@7'], clientMoved: true },
      }),
    ).toEqual([
      '1. Set DATABASE_URL in your environment (export it or add it to .env).',
      '2. Install the project dependencies with your package manager (this run skipped them), including @prisma/prisma7@7.',
      '3. Emit the contract: `prisma contract emit`',
      '4. Adopt your existing database: `prisma db sign` verifies it against the contract and records the signing marker and the `db` ref. It makes no change to the database schema.',
      '5. Move your routes one at a time to the Prisma 8 client in src/prisma/db.ts.',
      '6. After each `prisma7 migrate dev`, run `prisma contract emit` and then `prisma db sign`.',
      '7. Run `prisma7 generate` so the Prisma 7 client matches the Prisma 7 CLI.',
      '8. Open prisma-8.md for a quick reference on the transition loop and your first typed query.',
      '9. Working with a coding agent? Run `prisma init` in this project to set up the Prisma agent skills.',
    ]);
  });
});
