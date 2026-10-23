import type { LedgerEntryRecord } from '@internal/contract/types';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { describe, expect, it } from 'vitest';
import { errorMarkerMismatch, readLedgerQuietly } from '../../src/utils/marker-mismatch';
import type { CliInvocation } from '../../src/utils/printed-command';
import { buildGraph, entry } from './graph-helpers';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_DELETED = 'd'.repeat(64);
const HASH_OTHER = 'e'.repeat(64);

const graph = buildGraph([
  entry(EMPTY_CONTRACT_HASH, HASH_A, '20261001T0000_initial'),
  entry(HASH_A, HASH_B, '20261014T0000_request_description_again'),
]);

const invocation: CliInvocation = { cwd: '/work/app', configPath: undefined, dbGiven: true };

function applied(migrationName: string, from: string | null, to: string): LedgerEntryRecord {
  return {
    space: 'app',
    migrationName,
    migrationHash: `sha256:${migrationName}`,
    from,
    to,
    appliedAt: new Date(0),
    operationCount: 1,
  };
}

const SUMMARY = 'The database is at a contract that is not in the migration graph';
const OPENING = `The database's marker names contract ${HASH_DELETED}, and no migration in migrations/app starts or ends there. This usually means a migration this database applied was later planned again or deleted, for example a branch that was deployed and then rebased.`;
const CLOSING = 'The database does not need to be reset or dropped.';
const KEEP_HISTORY_CHOICE =
  "If this database's migration history does not need to be kept (a local, development, staging or preview database), reconcile it to the target:";
const DRY_RUN = `{bin} db update --to ${HASH_B} --dry-run --db <url>`;
const RECONCILE = `{bin} db update --to ${HASH_B} --db <url>`;

function migrationsOnly(from: string): string {
  return `If this database changes only through migrations, as production should: author a migration from ${from} to the database's current contract, then one from there to ${HASH_B}, commit them, and deploy again.`;
}

function expectedEnvelope(args: {
  readonly history: string;
  readonly from: string;
  readonly meta: Record<string, unknown>;
}) {
  return {
    ok: false,
    code: 'MIGRATION.MARKER_MISMATCH',
    severity: 'error',
    summary: SUMMARY,
    why: [OPENING, args.history, CLOSING].filter((part) => part !== '').join(' '),
    fix: [
      KEEP_HISTORY_CHOICE,
      `  ${DRY_RUN}`,
      `  ${RECONCILE}`,
      '  Then deploy again.',
      migrationsOnly(args.from),
    ].join('\n'),
    nextActions: [
      { kind: 'user-choice', label: KEEP_HISTORY_CHOICE },
      { kind: 'run-command', label: 'Preview the changes', command: DRY_RUN },
      { kind: 'run-command', label: 'Reconcile the database', command: RECONCILE },
      { kind: 'user-choice', label: 'Then deploy again.' },
      { kind: 'user-choice', label: migrationsOnly(args.from) },
    ],
    meta: args.meta,
  };
}

function mismatch(
  ledger: readonly LedgerEntryRecord[] | undefined,
  overrides: { readonly spaceId?: string; readonly markerHash?: string } = {},
) {
  return errorMarkerMismatch({
    spaceId: overrides.spaceId ?? 'app',
    markerHash: overrides.markerHash ?? HASH_DELETED,
    targetHash: HASH_B,
    graph,
    migrationsDir: '/work/app/migrations',
    ledger,
    invocation,
  }).toEnvelope();
}

describe('errorMarkerMismatch', () => {
  it('names the last graph contract and the migration no longer on disk', () => {
    const ledger = [
      applied('20261001T0000_initial', null, HASH_A),
      applied('20261013T0910_request_description', HASH_A, HASH_DELETED),
    ];

    expect(mismatch(ledger)).toEqual(
      expectedEnvelope({
        history: `The database last applied ${HASH_A}, then 20261013T0910_request_description, which is no longer on disk.`,
        from: HASH_A,
        meta: {
          spaceId: 'app',
          markerHash: HASH_DELETED,
          targetHash: HASH_B,
          lastGraphHash: HASH_A,
          missingMigrations: ['20261013T0910_request_description'],
        },
      }),
    );
  });

  it('lists every migration applied after the last graph contract, oldest first', () => {
    const ledger = [
      applied('20261001T0000_initial', null, HASH_A),
      applied('20261013T0910_first', HASH_A, HASH_OTHER),
      applied('20261013T0911_second', HASH_OTHER, HASH_DELETED),
    ];

    expect(mismatch(ledger)).toEqual(
      expectedEnvelope({
        history: `The database last applied ${HASH_A}, then 20261013T0910_first, 20261013T0911_second, which are no longer on disk.`,
        from: HASH_A,
        meta: {
          spaceId: 'app',
          markerHash: HASH_DELETED,
          targetHash: HASH_B,
          lastGraphHash: HASH_A,
          missingMigrations: ['20261013T0910_first', '20261013T0911_second'],
        },
      }),
    );
  });

  it('names only the last graph contract when no migration came after it', () => {
    const ledger = [applied('20261001T0000_initial', null, HASH_A)];

    expect(mismatch(ledger)).toEqual(
      expectedEnvelope({
        history: `The database last applied ${HASH_A}.`,
        from: HASH_A,
        meta: {
          spaceId: 'app',
          markerHash: HASH_DELETED,
          targetHash: HASH_B,
          lastGraphHash: HASH_A,
          missingMigrations: [],
        },
      }),
    );
  });

  it.each([
    { case: 'the ledger is empty', ledger: [] },
    {
      case: 'no ledger entry ends in the graph',
      ledger: [
        applied('20261013T0910_first', null, HASH_OTHER),
        applied('20261013T0911_second', HASH_OTHER, HASH_DELETED),
      ],
    },
    { case: 'the ledger could not be read', ledger: undefined },
  ])(
    'leaves the history out and starts from the nearest graph contract when $case',
    ({ ledger }) => {
      expect(mismatch(ledger)).toEqual(
        expectedEnvelope({
          history: '',
          from: 'the nearest contract in the migration graph',
          meta: {
            spaceId: 'app',
            markerHash: HASH_DELETED,
            targetHash: HASH_B,
            missingMigrations: [],
          },
        }),
      );
    },
  );

  it("names an extension space's migrations directory", () => {
    const envelope = mismatch([], { spaceId: 'pgvector' });

    expect({ why: envelope.why, meta: envelope.meta }).toEqual({
      why: `The database's marker names contract ${HASH_DELETED}, and no migration in migrations/pgvector starts or ends there. This usually means a migration this database applied was later planned again or deleted, for example a branch that was deployed and then rebased. ${CLOSING}`,
      meta: {
        spaceId: 'pgvector',
        markerHash: HASH_DELETED,
        targetHash: HASH_B,
        missingMigrations: [],
      },
    });
  });

  it('prints the commands with the --config the CLI was given and no --db when it was not given', () => {
    const envelope = errorMarkerMismatch({
      spaceId: 'app',
      markerHash: HASH_DELETED,
      targetHash: HASH_B,
      graph,
      migrationsDir: '/work/app/migrations',
      ledger: [],
      invocation: { cwd: '/work/app', configPath: 'config/prisma.config.ts', dbGiven: false },
    });

    expect(
      envelope.nextActions.flatMap((action) =>
        action.command === undefined ? [] : [action.command],
      ),
    ).toEqual([
      `{bin} db update --to ${HASH_B} --dry-run --config config/prisma.config.ts`,
      `{bin} db update --to ${HASH_B} --config config/prisma.config.ts`,
    ]);
  });
});

describe('readLedgerQuietly', () => {
  it('returns the ledger the read gives', async () => {
    const ledger = [applied('20261001T0000_initial', null, HASH_A)];

    expect(await readLedgerQuietly(async () => ledger)).toEqual(ledger);
  });

  it('returns undefined when the read fails', async () => {
    expect(
      await readLedgerQuietly(async () => {
        throw new Error('permission denied for table _prisma_ledger');
      }),
    ).toBeUndefined();
  });
});
