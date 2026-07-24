/**
 * Project DoD-2 and DoD-3 — the emitted contract is the database's
 * signature.
 *
 * DoD-2: a database created "by another tool" carries an expression index, a
 * partial index, a unique expression index, and two RLS policies (one
 * PERMISSIVE, one RESTRICTIVE) on an RLS-enabled table. `contract infer` →
 * emit → `db verify` reports ZERO issues → `db update --dry-run` plans ZERO
 * operations.
 *
 * DoD-3: from that signed contract, one index and one policy transition
 * from `map:` to the managed spelling (bodies verbatim) → the widening plan
 * contains EXACTLY two ops, both renames (byte-asserted) → apply → verify
 * clean under the wire names.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeIndexContentHash, normalizeSqlBody } from '@prisma-next/sql-schema-ir/naming';
import { computeContentHash } from '@prisma-next/target-postgres/rls-canonicalize';
import { withClient } from '@prisma-next/test-utils';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
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

const MANAGED_INDEX_NAME = `documents_email_lower_${computeIndexContentHash({
  expression: 'lower(email)',
  unique: false,
})}`;

const MANAGED_POLICY_NAME = `Tenant_members_can_read_${computeContentHash({
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

withTempDir(({ createTempDir }) => {
  describe('DoD-2/3: sign a database this toolchain has never seen, then transition to managed', () => {
    const db = useDevDatabase({
      onReady: (cs) => withClient(cs, (client) => client.query(FOREIGN_TOOL_SCHEMA)),
    });

    it(
      'infer → emit → verify zero issues → dry-run zero ops → map:-to-managed plan is exactly two renames',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });

        // DoD-2.1: infer captures the full surface.
        const infer = await runContractInfer(ctx);
        expect(infer.exitCode, `2.1: contract infer\n${stripAnsi(infer.stderr)}`).toBe(0);
        const inferredPsl = readFileSync(join(ctx.testDir, 'contract.prisma'), 'utf-8');
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

        // DoD-2.2: emit → verify ZERO issues.
        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, `2.2: contract emit\n${stripAnsi(emit.stderr)}`).toBe(0);
        const schemaVerify = await runDbVerify(ctx, ['--schema-only', '--json']);
        expect(schemaVerify.exitCode, `2.2: verify\n${stripAnsi(schemaVerify.stderr)}`).toBe(0);
        expect(parseJsonOutput(schemaVerify), '2.2: zero issues').toMatchObject({
          ok: true,
          schema: { issues: [] },
        });

        // DoD-2.3: sign; a dry-run update plans ZERO operations.
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

        // DoD-3.1: baseline migration so migration plan diffs from the
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

        // DoD-3.2: transition ONE index and ONE policy to managed spellings,
        // bodies verbatim.
        const transitioned = inferredPsl
          .replace(
            '@@index(expression: "lower(email)", map: "documents_email_lower_idx")',
            '@@index(expression: "lower(email)", name: "documents_email_lower")',
          )
          .replace('    @@map("Tenant members can read")\n', '');
        expect(transitioned).not.toBe(inferredPsl);
        writeFileSync(join(ctx.testDir, 'contract.prisma'), transitioned, 'utf-8');
        const emitManaged = await runContractEmit(ctx);
        expect(emitManaged.exitCode, `3.2: emit managed\n${stripAnsi(emitManaged.stderr)}`).toBe(0);

        // DoD-3.3: the widening plan is EXACTLY the two renames.
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'adopt-managed-names']);
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
            sql: `ALTER INDEX "public"."documents_email_lower_idx" RENAME TO "${MANAGED_INDEX_NAME}"`,
          },
          {
            id: 'rlsPolicy.public.documents.Tenant members can read.rename',
            operationClass: 'widening',
            sql: `ALTER POLICY "Tenant members can read" ON "public"."documents" RENAME TO "${MANAGED_POLICY_NAME}"`,
          },
        ]);

        // DoD-3.4: apply; verify clean under the wire names.
        const apply = await runMigrate(ctx);
        expect(apply.exitCode, `3.4: migration apply\n${stripAnsi(apply.stderr)}`).toBe(0);
        const verifyManaged = await runDbVerify(ctx);
        expect(
          verifyManaged.exitCode,
          `3.4: verify clean\n${stripAnsi(verifyManaged.stderr)}`,
        ).toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
