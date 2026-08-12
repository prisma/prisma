import type { Contract } from '@internal/contract/types';
import type {
  ControlAdapterInstance,
  ControlDriverInstance,
  ControlFamilyInstance,
  TargetMigrationsCapability,
} from '@internal/framework-components/control';
import { ok } from '@internal/utils/result';
import { describe, expect, it, vi } from 'vitest';
import { executeDbInit } from '../../src/control-api/operations/db-init';

function createMockDriver() {
  return {
    close: vi.fn(),
  } as unknown as ControlDriverInstance<'sql', 'postgres'>;
}

function createMockFamilyInstance() {
  return {
    familyId: 'sql',
    readAllMarkers: async () => new Map(),
    introspect: async () => ({ tables: {} }),
    deserializeContract: (ir: unknown) => ir as Contract,
    toOperationPreview: () => ({ statements: [] }),
  } as unknown as ControlFamilyInstance<'sql', unknown>;
}

const dummyContract = {
  schemaVersion: '1',
  target: 'postgres',
  storage: { storageHash: 'dummy', tables: {}, namespaces: {} },
} as unknown as Contract;

describe('executeDbInit', () => {
  it('passes fromContract: null to planner.plan (no prior contract under reconciliation)', async () => {
    const planFn = vi.fn().mockReturnValue({
      kind: 'success',
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'dest' },
        operations: [],
      },
    });

    const migrations = {
      createPlanner: () => ({ plan: planFn }),
      createRunner: () => ({
        execute: vi.fn().mockResolvedValue(
          ok({
            perSpaceResults: [
              { space: 'app', value: { operationsPlanned: 0, operationsExecuted: 0 } },
            ],
          }),
        ),
      }),
    } as unknown as TargetMigrationsCapability<
      'sql',
      'postgres',
      ControlFamilyInstance<'sql', unknown>
    >;

    await executeDbInit({
      driver: createMockDriver(),
      adapter: {} as unknown as ControlAdapterInstance<'sql', 'postgres'>,
      familyInstance: createMockFamilyInstance(),
      contract: dummyContract,
      mode: 'plan',
      migrations,
      frameworkComponents: [],
      migrationsDir: '/tmp/__test-db-init-migrations',
      targetId: 'postgres',
    });

    expect(planFn).toHaveBeenCalledWith(
      expect.objectContaining({
        // `db init` reconciles against the live introspected schema and has
        // structural representation of "no origin contract" (AC-5).
      }),
    );
  });
});
