/**
 * The mutation prologue of `executeMigrationPlanCommand` (config load, context
 * resolution, from/to resolution, seed phase) runs before the planner-phase
 * try block. A throw there must still surface as notOk(CliStructuredError) —
 * never as an unhandled rejection past the Result contract.
 */
import { errorInvalidJson } from '@internal/migration-tools/errors';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

describe('executeMigrationPlanCommand — mutation-prologue guard', () => {
  it('maps a MigrationToolsError thrown in the prologue to a structured failure', async () => {
    const toolsError = errorInvalidJson('/project/prisma-next.config.ts', 'Unexpected token');
    mocks.loadConfig.mockRejectedValueOnce(toolsError);
    const { executeMigrationPlanCommand } = await import(
      '../../src/control-api/operations/migration-plan'
    );

    const result = await executeMigrationPlanCommand(
      { config: '/project/prisma-next.config.ts' },
      Date.now(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.INVALID_JSON');
    expect(envelope.summary).toBe(toolsError.message);
    expect(envelope.why).toBe(toolsError.why);
  });

  it('maps an unknown prologue throw to the CLI.UNEXPECTED envelope', async () => {
    mocks.loadConfig.mockRejectedValueOnce(new Error('config loader exploded'));
    const { executeMigrationPlanCommand } = await import(
      '../../src/control-api/operations/migration-plan'
    );

    const result = await executeMigrationPlanCommand(
      { config: '/project/prisma-next.config.ts' },
      Date.now(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('CLI.UNEXPECTED');
    expect(envelope.why).toBe('Unexpected error during migration plan: config loader exploded');
  });
});
