import { describe, expect, it } from 'vitest';
import { buildInitNextActions } from '../../src/orm/init-blocks';

const inputs = {
  target: 'postgres',
  contractEmitted: false,
  schemaPath: 'src/prisma/contract.prisma',
  prisma7: null,
} as const;

describe('init next actions', () => {
  it('offers create-db and deployment for a new Postgres project', () => {
    const actions = buildInitNextActions(inputs);

    expect(actions[1]).toEqual({
      kind: 'run-command',
      label:
        'No database yet? Create a temporary Prisma Postgres database (deleted after 24 hours unless you claim it)',
      command: 'npx create-db@latest',
    });
    expect(actions.at(-2)).toEqual({
      kind: 'user-choice',
      label:
        'To host the app, deploy a Prisma Composer (Early Access) app to Prisma Compute with `prisma deploy module.ts` after `prisma auth login` and a build; the first deploy also needs a region (`PRISMA_REGION` or the deploy config): https://www.prisma.io/docs/compute/getting-started',
    });
    expect(actions.at(-1)).toEqual({
      kind: 'run-command',
      label: 'Set up the Prisma agent skills for your coding agent',
      command: 'prisma init',
    });
  });

  it('keeps the MongoDB actions unchanged', () => {
    expect(buildInitNextActions({ ...inputs, target: 'mongodb' })).toEqual([
      {
        kind: 'user-choice',
        label: 'Set DATABASE_URL in your environment (export it or add it to .env)',
      },
      { kind: 'run-command', label: 'Emit the contract', command: 'prisma contract emit' },
      {
        kind: 'edit-file',
        label: 'Edit your schema at src/prisma/contract.prisma, then emit again',
      },
      {
        kind: 'user-choice',
        label: 'Open prisma-8.md for a quick reference on writing your first typed query',
      },
      {
        kind: 'run-command',
        label: 'Set up the Prisma agent skills for your coding agent',
        command: 'prisma init',
      },
    ]);
  });

  it('keeps the Prisma 7 actions unchanged', () => {
    expect(buildInitNextActions({ ...inputs, prisma7: { clientMoved: true } })).toEqual([
      {
        kind: 'user-choice',
        label: 'Set DATABASE_URL in your environment (export it or add it to .env)',
      },
      { kind: 'run-command', label: 'Emit the contract', command: 'prisma contract emit' },
      {
        kind: 'run-command',
        label:
          'Adopt your existing database: `prisma db sign` verifies it against the contract and records the signing marker and the `db` ref. It makes no change to the database schema.',
        command: 'prisma db sign',
      },
      {
        kind: 'edit-file',
        label: 'Move your routes one at a time to the Prisma 8 client in src/prisma/db.ts',
      },
      {
        kind: 'user-choice',
        label:
          'After each `prisma7 migrate dev`, run `prisma contract emit` and then `prisma db sign`.',
      },
      {
        kind: 'run-command',
        label: 'Regenerate the Prisma 7 client to match its CLI',
        command: 'prisma7 generate',
      },
      {
        kind: 'user-choice',
        label:
          'Open prisma-8.md for a quick reference on the transition loop and your first typed query.',
      },
      {
        kind: 'run-command',
        label: 'Set up the Prisma agent skills for your coding agent',
        command: 'prisma init',
      },
    ]);
  });
});
