import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { type EngineRunResult, runOnEngine } from '../../../../utils/cli-test-helpers';

// Port of prisma/prisma@a6d0155
//   packages/client/tests/functional/relationMode-in-separate-gh-action/tests_m-to-n.ts
//   → isSchemaUsingMap=true (@map/@@map) matrix variants, m:n mandatory (explicit).
//
// The faithful @map schemas produce a 56-byte default prefix for the generated
// category FK-backing index. Synthesized index prefixes truncate to the 54-byte
// wire-name budget before the 9-byte content-hash suffix is appended.
//
// The referential-action behaviour these variants cover is exercised by the
// four `-nomap` variants in create/update/delete.test.ts. These tests retain the
// mapped variants as emit coverage because @map changes only physical names.

const MAP_VARIANTS = ['default-map', 'cascade-map', 'noaction-map', 'restrict-map'] as const;

async function emitVariant(variant: (typeof MAP_VARIANTS)[number]): Promise<EngineRunResult> {
  const outputPath = mkdtempSync(join(tmpdir(), 'mton-map-emit-'));
  const testDir = join(import.meta.dirname, '_fixture', variant);
  try {
    return await runOnEngine({ testDir, configPath: join(testDir, 'prisma.config.ts') }, [
      'contract',
      'emit',
      '--output-path',
      outputPath,
      '--json',
    ]);
  } finally {
    rmSync(outputPath, { recursive: true, force: true });
  }
}

describe('ports/prisma/functional/relationMode-gh-m-to-n › emit @map', () => {
  for (const variant of MAP_VARIANTS) {
    it(
      `${variant} emits the faithful @map contract`,
      async () => {
        const run = await emitVariant(variant);
        expect(run.exitCode).toBe(0);
        expect(run.presented?.data).toMatchObject({ ok: true });
      },
      timeouts.typeScriptCompilation,
    );
  }
});
