/**
 * AC15 lock — `buildContractSpaceAggregate` (and thus the `db verify`
 * aggregate path) must never read `contractSpace.contractJson` from
 * extension descriptors.
 *
 * The aggregate loader reads contracts from on-disk artefacts
 * (`migrations/<id>/contract.json`). Reading `contractSpace.contractJson`
 * from the descriptor was a leftover from the old drift-check path and
 * was eliminated as part of TML-2457.
 *
 * Technique: pass an extension whose `contractSpace` property is a getter
 * that throws. If `buildContractSpaceAggregate` ever accesses the property,
 * the exception propagates out (it is not caught internally) and the test
 * fails. If the loader only uses `id` + `targetId` from the descriptor, the
 * result is a normal `Result` object and the test passes.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Contract } from '@internal/contract/types';
import type { ControlExtensionDescriptor } from '@internal/framework-components/control';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildContractSpaceAggregate } from '../../src/control-api/operations/contract-space-aggregate-loader';

const STUB_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const STUB_APP_CONTRACT = {
  storage: { storageHash: STUB_HASH, namespaces: {} },
  target: 'postgres',
} as unknown as Contract;

describe('buildContractSpaceAggregate — AC15: does not read contractSpace.contractJson', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-ac15-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns a Result without accessing contractSpace when the getter throws', async () => {
    const throwingExtension = Object.defineProperty(
      { id: 'test-ext', targetId: 'postgres' as const },
      'contractSpace',
      {
        get() {
          throw new Error('AC15 violation: buildContractSpaceAggregate accessed contractSpace');
        },
        enumerable: true,
        configurable: true,
      },
    ) as unknown as ControlExtensionDescriptor<'sql', 'postgres'>;

    // buildContractSpaceAggregate must return a Result — not throw.
    // The aggregate loader cannot find a migrations/<test-ext>/ directory
    // (it does not exist in tempDir), so the result is a layout-violation
    // failure, but it is a *returned* Result rather than a thrown exception.
    const result = await buildContractSpaceAggregate({
      targetId: 'postgres',
      migrationsDir: join(tempDir, 'migrations'),
      appContract: STUB_APP_CONTRACT,
      extensions: [throwingExtension],
      deserializeContract: () => STUB_APP_CONTRACT,
    });

    // The getter was never invoked — we got a Result instead of a thrown error.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Confirm the failure is layout-related (missing migration dir), not
      // anything to do with contractSpace access.
      expect(result.failure.message).not.toContain('contractSpace');
    }
  });
});
