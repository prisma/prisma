/**
 * The emitted contract is the database's signature.
 *
 * First half: a database created "by another tool" carries an expression index, a
 * partial index, a unique expression index, and two RLS policies (one
 * PERMISSIVE, one RESTRICTIVE) on an RLS-enabled table. `contract infer` →
 * emit → `db verify` reports ZERO issues → `db update --dry-run` plans ZERO
 * operations.
 *
 * Second half: from that signed contract, one index and one policy transition
 * from `map:` to the wire spelling (bodies verbatim) → the widening plan
 * contains EXACTLY two ops, both renames (byte-asserted) → apply → verify
 * clean under the wire names.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withClient } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterAll, describe, expect, it } from 'vitest';
import {
  computeContentHash,
  computeIndexContentHash,
  normalizeSqlBody,
} from '../utils/cli-commands';
import { fixtureAppDir } from '../utils/cli-test-helpers';
import {
  engineDocument,
  getLatestMigrationDir,
  type JourneyContext,
  parseJsonOutput,
  runContractEmit,
  runContractInfer,
  runDbSign,
  runDbUpdate,
  runDbVerify,
  runMigrate,
  runMigrationPlanAndEmit,
  setupJourney,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

const FOREIGN_TOOL_SCHEMA = `
  CREATE ROLE tenant_app_user;
  CREATE TABLE documents (
    id int4 PRIMARY KEY,
    tenant_id int4 NOT NULL,
    email text NOT NULL,
    archived_at timestamptz
  );
  CREATE INDEX documents_email_lower_idx ON documents (lower(email));
  CREATE INDEX documents_active_idx ON documents (tenant_id) WHERE (archived_at IS NULL);
  CREATE UNIQUE INDEX documents_email_ci_key ON documents (lower(email));
  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Tenant members can read" ON documents
    AS PERMISSIVE FOR SELECT TO tenant_app_user
    USING (tenant_id = 1);
  CREATE POLICY "Deny cross tenant writes" ON documents
    AS RESTRICTIVE FOR UPDATE TO tenant_app_user
    USING (tenant_id = 1) WITH CHECK (tenant_id = 1);
`;

const WIRE_INDEX_NAME = `documents_email_lower_${computeIndexContentHash({
  expression: 'lower(email)',
  unique: false,
})}`;

const WIRE_POLICY_NAME = `Tenant_members_can_read_${computeContentHash({
  using: normalizeSqlBody('(tenant_id = 1)'),
  roles: ['tenant_app_user'],
  operation: 'select',
  permissive: true,
})}`;

interface PlannedOp {
  readonly id: string;
  readonly operationClass: string;
  readonly execute: readonly { readonly description: string; readonly sql: string }[];
}

function readPlannedOps(ctx: JourneyContext): readonly PlannedOp[] {
  const dir = getLatestMigrationDir(ctx);
  expect(dir, 'planned migration dir exists').toBeDefined();
  return JSON.parse(
    readFileSync(join(ctx.testDir, 'migrations/app', dir ?? '', 'ops.json'), 'utf-8'),
  );
}

// Both steps mutate the one live database and the second continues from the
// state the first left, so a retried step would replay against a database it
// has already changed. `retry: 0` overrides the suite-wide CI retry budget
// here: a flake must surface as itself rather than as a second, misleading
// failure from the replay.
describe('sign a database this toolchain has never seen, then transition to wire naming', {
  retry: 0,
}, () => {
  const db = useDevDatabase({
    onReady: (cs) => withClient(cs, (client) => client.query(FOREIGN_TOOL_SCHEMA)),
  });

  // The two its run sequentially and share the journey state: the second
  // continues from the database the first signed, so the journey dir lives
  // for the whole describe (withTempDir would delete it between its).
  const journeyDir = join(fixtureAppDir, `test-${Date.now()}-sign-the-database`);
  const createTempDir = () => {
    mkdirSync(journeyDir, { recursive: true });
    return journeyDir;
  };
  afterAll(() => {
    rmSync(journeyDir, { recursive: true, force: true });
  });

  let ctx: JourneyContext;
  let inferredPsl: string;

  it(
    'infer → emit → verify zero issues → sign → dry-run zero ops',
    async () => {
      ctx = setupJourney({
        connectionString: db.connectionString,
        createTempDir,
        contractMode: 'psl',
      });

      // Infer captures the full surface.
      const infer = await runContractInfer(ctx);
      expect(infer.exitCode, `2.1: contract infer\n${stripAnsi(infer.stderr)}`).toBe(0);
      inferredPsl = readFileSync(join(ctx.testDir, 'contract.prisma'), 'utf-8');
      expect(inferredPsl).toContain(
        '@@index(expression: "lower(email)", map: "documents_email_lower_idx")',
      );
      expect(inferredPsl).toContain(
        '@@index([tenantId], map: "documents_active_idx", where: "(archived_at IS NULL)")',
      );
      expect(inferredPsl).toContain(
        '@@index(expression: "lower(email)", map: "documents_email_ci_key", unique: true)',
      );
      expect(inferredPsl).toContain('policy_select Tenant_members_can_read {');
      expect(inferredPsl).toContain('@@map("Tenant members can read")');
      expect(inferredPsl).toContain('policy_update Deny_cross_tenant_writes {');
      expect(inferredPsl).toContain('permissive = false');
      expect(inferredPsl).toContain('@@rls');

      // Emit → verify ZERO issues.
      const emit = await runContractEmit(ctx);
      expect(emit.exitCode, `2.2: contract emit\n${stripAnsi(emit.stderr)}`).toBe(0);
      const schemaVerify = await runDbVerify(ctx, ['--schema-only', '--json']);
      expect(schemaVerify.exitCode, `2.2: verify\n${stripAnsi(schemaVerify.stderr)}`).toBe(0);
      expect(engineDocument(schemaVerify), '2.2: zero issues').toMatchObject({
        ok: true,
        schema: { issues: [] },
      });

      // Sign; a dry-run update plans ZERO operations.
      const sign = await runDbSign(ctx);
      expect(sign.exitCode, `2.3: db sign\n${stripAnsi(sign.stderr)}`).toBe(0);
      const verify = await runDbVerify(ctx);
      expect(verify.exitCode, `2.3: db verify\n${stripAnsi(verify.stderr)}`).toBe(0);
      const dryRun = await runDbUpdate(ctx, ['--dry-run', '--json']);
      expect(dryRun.exitCode, `2.3: db update dry-run\n${stripAnsi(dryRun.stderr)}`).toBe(0);
      expect(parseJsonOutput(dryRun), '2.3: zero operations').toMatchObject({
        ok: true,
        plan: { operations: [] },
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'map:-to-wire transition plans exactly two renames, applies, verifies clean',
    async () => {
      expect(ctx, 'the signing step must have completed').toBeDefined();

      // Baseline migration so migration plan diffs from the
      // adopted contract; a fresh migrate is a no-op against the live DB.
      const planBaseline = await runMigrationPlanAndEmit(ctx, ['--name', 'baseline']);
      expect(planBaseline.exitCode, `3.1: plan baseline\n${stripAnsi(planBaseline.stderr)}`).toBe(
        0,
      );
      const applyBaseline = await runMigrate(ctx, ['--json']);
      expect(
        applyBaseline.exitCode,
        `3.1: apply baseline\n${stripAnsi(applyBaseline.stderr)}`,
      ).toBe(0);
      expect(parseJsonOutput(applyBaseline), '3.1: baseline no-op').toMatchObject({
        migrationsApplied: 0,
      });

      // Transition ONE index and ONE policy to wire spellings,
      // bodies verbatim.
      const transitioned = inferredPsl
        .replace(
          '@@index(expression: "lower(email)", map: "documents_email_lower_idx")',
          '@@index(expression: "lower(email)", name: "documents_email_lower")',
        )
        .replace(/^\s*@@map\("Tenant members can read"\)\n/m, '');
      // The index replacement above cannot mask a no-op here: prove the
      // @@map line itself is gone, not merely that something changed.
      expect(transitioned).not.toContain('@@map("Tenant members can read")');
      writeFileSync(join(ctx.testDir, 'contract.prisma'), transitioned, 'utf-8');
      const emitWire = await runContractEmit(ctx);
      expect(emitWire.exitCode, `3.2: emit wire\n${stripAnsi(emitWire.stderr)}`).toBe(0);

      // The widening plan is EXACTLY the two renames.
      const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'adopt-wire-names']);
      expect(plan.exitCode, `3.3: migration plan\n${stripAnsi(plan.stderr)}`).toBe(0);
      const ops = readPlannedOps(ctx);
      expect(
        ops
          .map((op) => ({
            id: op.id,
            operationClass: op.operationClass,
            sql: op.execute[0]?.sql,
          }))
          .sort((a, b) => (a.id < b.id ? -1 : 1)),
        '3.3: exactly two renames',
      ).toEqual([
        {
          id: 'index.public.documents.documents_email_lower_idx.rename',
          operationClass: 'widening',
          sql: `ALTER INDEX "public"."documents_email_lower_idx" RENAME TO "${WIRE_INDEX_NAME}"`,
        },
        {
          id: 'rlsPolicy.public.documents.Tenant members can read.rename',
          operationClass: 'widening',
          sql: `ALTER POLICY "Tenant members can read" ON "public"."documents" RENAME TO "${WIRE_POLICY_NAME}"`,
        },
      ]);

      // Apply; verify clean under the wire names.
      const apply = await runMigrate(ctx);
      expect(apply.exitCode, `3.4: migration apply\n${stripAnsi(apply.stderr)}`).toBe(0);
      const verifyWire = await runDbVerify(ctx);
      expect(verifyWire.exitCode, `3.4: verify clean\n${stripAnsi(verifyWire.stderr)}`).toBe(0);
    },
    timeouts.spinUpPpgDev,
  );
});
