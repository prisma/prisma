import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContractFromTs } from '@internal/cli';
import { emit } from '@internal/emitter/test/utils';
import {
  extractCodecTypeImports,
  extractComponentIds,
} from '@internal/framework-components/control';
import { sqlEmission } from '@internal/sql-contract-emitter';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSqlDescriptorBundle } from '../utils/framework-components';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../../../packages/1-framework/3-tooling/cli/test/fixtures');

describe('emit command functionality', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = join(
      tmpdir(),
      `prisma-8-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  const buildEmitterArtifacts = () => {
    const { adapter, target, extensions } = getSqlDescriptorBundle();
    const descriptors = [target, adapter, ...extensions];
    return {
      codecTypeImports: extractCodecTypeImports(descriptors),
      extensionIds: extractComponentIds({ id: 'sql' }, target, adapter, extensions),
    };
  };

  it(
    'loads TS contract and emits contract.json and contract.d.ts',
    async () => {
      const contractPath = join(fixturesDir, 'valid-contract.ts');
      const contract = await loadContractFromTs(contractPath);
      const { codecTypeImports, extensionIds } = buildEmitterArtifacts();

      const result = await emit(
        contract,
        {
          codecTypeImports,
          extensionIds,
        },
        sqlEmission,
      );

      const contractJsonPath = join(outputDir, 'contract.json');
      const contractDtsPath = join(outputDir, 'contract.d.ts');

      writeFileSync(contractJsonPath, result.contractJson, 'utf-8');
      writeFileSync(contractDtsPath, result.contractDts, 'utf-8');

      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
      expect(contractJson).toMatchObject({
        targetFamily: 'sql',
        target: 'postgres',
        storage: {
          namespaces: {
            public: {
              entries: {
                table: {
                  user: expect.anything(),
                },
              },
            },
          },
        },
      });

      const contractDts = readFileSync(contractDtsPath, 'utf-8');
      expect(contractDts).toContain('export type Contract');
      expect(contractDts).toContain('CodecTypes');
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'emits contract with correct storageHash',
    async () => {
      const contractPath = join(fixturesDir, 'valid-contract.ts');
      const contract = await loadContractFromTs(contractPath);
      const { codecTypeImports, extensionIds } = buildEmitterArtifacts();

      const result = await emit(
        contract,
        {
          codecTypeImports,
          extensionIds,
        },
        sqlEmission,
      );

      expect(result.storageHash).toMatch(/^[a-f0-9]{64}$/);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'creates output directory if it does not exist',
    async () => {
      const newOutputDir = join(tmpdir(), `prisma-8-test-new-${Date.now()}`);
      const contractPath = join(fixturesDir, 'valid-contract.ts');
      const contract = await loadContractFromTs(contractPath);
      const { codecTypeImports, extensionIds } = buildEmitterArtifacts();

      const result = await emit(
        contract,
        {
          codecTypeImports,
          extensionIds,
        },
        sqlEmission,
      );

      mkdirSync(newOutputDir, { recursive: true });

      const contractJsonPath = join(newOutputDir, 'contract.json');
      const contractDtsPath = join(newOutputDir, 'contract.d.ts');

      writeFileSync(contractJsonPath, result.contractJson, 'utf-8');
      writeFileSync(contractDtsPath, result.contractDts, 'utf-8');

      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      if (existsSync(newOutputDir)) {
        rmSync(newOutputDir, { recursive: true, force: true });
      }
    },
    timeouts.typeScriptCompilation,
  );
});
