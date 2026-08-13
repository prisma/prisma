import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '@internal/config-loader';
import { createControlStack } from '@internal/framework-components/control';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import {
  integrationFixtureAppDir,
  runOnEngine,
  setupIntegrationTestDirectoryFromFixtures,
} from './utils/cli-test-helpers';

const fixtureSubdir = 'emit-command';

describe('emit command: additional fixtures', () => {
  it('emits equivalent hashes from psl and ts providers', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const tsSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.parity-ts.ts',
    );
    const pslSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.parity-psl.ts',
    );

    try {
      const tsRun = await runOnEngine(tsSetup, ['contract', 'emit', '--json']);
      expect(tsRun.exitCode).toBe(0);
      const tsContract = JSON.parse(
        readFileSync(join(tsSetup.outputDir, 'contract.json'), 'utf-8'),
      ) as Record<string, unknown>;
      const storage = tsContract['storage'] as Record<string, unknown>;
      const storageHash = storage['storageHash'];
      const profileHash = tsContract['profileHash'];
      expect(storageHash).toMatch(/^[a-f0-9]{64}$/);
      expect(profileHash).toMatch(/^[a-f0-9]{64}$/);
      const tsProviderStorageHash = storageHash as string;
      const tsProviderProfileHash = profileHash as string;

      writeFileSync(
        join(pslSetup.testDir, 'schema.prisma'),
        readFileSync(
          join(integrationFixtureAppDir, 'fixtures', fixtureSubdir, 'schema.parity.psl'),
          'utf-8',
        ),
        'utf-8',
      );

      const pslRun = await runOnEngine(pslSetup, ['contract', 'emit', '--json']);
      expect(pslRun.exitCode).toBe(0);

      const contractJsonPath = join(pslSetup.testDir, 'output/contract.json');
      const contractDtsPath = join(pslSetup.testDir, 'output/contract.d.ts');
      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      const emitted = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
      const emittedStorage = emitted['storage'] as Record<string, unknown>;
      const emittedStorageHash = emittedStorage['storageHash'];
      const emittedProfileHash = emitted['profileHash'];

      expect(emitted).toMatchObject({
        targetFamily: 'sql',
      });
      expect(emittedStorageHash).toMatch(/^[a-f0-9]{64}$/);
      expect(emittedProfileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(emittedStorageHash).toBe(tsProviderStorageHash);
      expect(emittedProfileHash).toBe(tsProviderProfileHash);
      expect(emitted).not.toHaveProperty('sources');
      expect(emitted).toMatchObject({
        meta: expect.not.objectContaining({
          source: expect.anything(),
          sourceId: expect.anything(),
          schemaPath: expect.anything(),
        }),
      });
    } finally {
      tsSetup.cleanup();
      pslSetup.cleanup();
    }
  });

  it('renders provider diagnostics when psl provider fails', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.parity-psl.ts',
    );

    try {
      writeFileSync(
        join(testSetup.testDir, 'schema.prisma'),
        `model Post {
  id Int @id
  data Unsupported
}
`,
        'utf-8',
      );

      const providerConfig = (
        await loadConfig(join(testSetup.testDir, 'prisma-next.config.ts'))
      ).assertOk().config;
      const contractConfig = providerConfig.contract;
      expect(contractConfig).toBeDefined();

      const stack = createControlStack({
        family: providerConfig.family,
        target: providerConfig.target,
        adapter: providerConfig.adapter,
        extensions: providerConfig.extensions ?? [],
      });
      const sourceResult = await contractConfig!.source.load({
        composedExtensions: stack.extensions.map((p) => p.id),
        composedExtensionContracts: new Map(),
        authoringContributions: stack.authoringContributions,
        codecLookup: stack.codecLookup,
        controlMutationDefaults: stack.controlMutationDefaults,
        resolvedInputs: contractConfig!.source.inputs ?? [],
        capabilities: stack.capabilities,
      });

      expect(sourceResult.ok).toBe(false);
      if (sourceResult.ok) {
        throw new Error('Expected source provider to fail for unsupported field type');
      }
      expect(sourceResult.failure.summary).toBe('PSL to SQL contract interpretation failed');
      expect(sourceResult.failure.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PSL_UNSUPPORTED_FIELD_TYPE',
            sourceId: './schema.prisma',
            span: expect.objectContaining({
              start: expect.objectContaining({ line: 3 }),
            }),
          }),
        ]),
      );

      const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
      expect(run.exitCode).toBe(2);

      const terminal = run.json.at(-1);
      const envelope =
        terminal !== undefined && terminal.kind === 'result' ? terminal.envelope : undefined;
      expect(envelope).toMatchObject({
        ok: false,
        error: {
          code: 'CONTRACT.SOURCE_LOAD_FAILED',
          why: 'PSL to SQL contract interpretation failed',
        },
      });

      const reported = JSON.stringify(envelope);
      expect(reported).toContain('PSL_UNSUPPORTED_FIELD_TYPE');
      expect(reported).toContain('schema.prisma');
    } finally {
      testSetup.cleanup();
    }
  });

  it('rejects plain-object configs that were not created by defineConfig', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.missing-output.ts',
    );

    try {
      const run = await runOnEngine(testSetup, ['contract', 'emit', '--json'], {
        settleConfigFailures: true,
      });
      expect(run.exitCode).toBe(2);

      const terminal = run.json.at(-1);
      const envelope =
        terminal !== undefined && terminal.kind === 'result' ? terminal.envelope : undefined;
      expect(envelope).toMatchObject({
        ok: false,
        error: { code: 'CONFIG.VERSION_MARKER_MISSING' },
      });
      expect(existsSync(join(testSetup.testDir, 'src/prisma/contract.json'))).toBe(false);
    } finally {
      testSetup.cleanup();
    }
  });

  it('emits contract.json and contract.d.ts with Mongo config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.mongo.ts',
    );

    try {
      writeFileSync(
        join(testSetup.testDir, 'contract.prisma'),
        `model User {
  id    ObjectId @id @map("_id")
  name  String
  email String
  posts Post[]
  @@map("users")
}

model Post {
  id        ObjectId @id @map("_id")
  title     String
  authorId  ObjectId
  author    User @relation(fields: [authorId], references: [id])
  @@map("posts")
}
`,
        'utf-8',
      );

      const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
      expect(run.exitCode).toBe(0);

      const contractJsonPath = join(testSetup.outputDir, 'contract.json');
      const contractDtsPath = join(testSetup.outputDir, 'contract.d.ts');

      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
      expect(contractJson).toMatchObject({
        targetFamily: 'mongo',
        target: 'mongo',
        domain: {
          namespaces: {
            __unbound__: {
              models: {
                User: expect.objectContaining({
                  fields: expect.objectContaining({
                    _id: {
                      type: { kind: 'scalar', codecId: 'mongo/objectId@1' },
                      nullable: false,
                    },
                    name: {
                      type: { kind: 'scalar', codecId: 'mongo/string@1' },
                      nullable: false,
                    },
                  }),
                }),
                Post: expect.objectContaining({
                  relations: expect.objectContaining({
                    author: expect.objectContaining({
                      to: { namespace: '__unbound__', model: 'User' },
                      cardinality: 'N:1',
                    }),
                  }),
                }),
              },
            },
          },
        },
      });

      const contractDts = readFileSync(contractDtsPath, 'utf-8');
      expect(contractDts).toContain('export type Contract');
      expect(contractDts).toContain('CodecTypes');

      expect(run.presented?.data).toMatchObject({
        ok: true,
        storageHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        files: {
          json: expect.stringContaining('contract.json'),
          dts: expect.stringContaining('contract.d.ts'),
        },
      });
    } finally {
      testSetup.cleanup();
    }
  });

  it('emits contract.json and contract.d.ts with Mongo contract.ts config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.mongo-contract-ts.ts',
    );

    try {
      const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
      expect(run.exitCode).toBe(0);

      const contractJsonPath = join(testSetup.outputDir, 'contract.json');
      const contractDtsPath = join(testSetup.outputDir, 'contract.d.ts');

      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
      expect(contractJson).toMatchObject({
        targetFamily: 'mongo',
        target: 'mongo',
        storage: {
          namespaces: {
            __unbound__: {
              entries: {
                collection: {
                  users: {
                    indexes: [{ keys: [{ field: 'email', direction: 1 }], unique: true }],
                    options: {
                      collation: { locale: 'en', strength: 2 },
                    },
                  },
                },
              },
            },
          },
        },
        domain: {
          namespaces: {
            __unbound__: {
              models: {
                Task: expect.objectContaining({
                  storage: expect.objectContaining({
                    collection: 'tasks',
                    relations: {
                      comments: { field: 'comments' },
                    },
                  }),
                  discriminator: { field: 'type' },
                  variants: {
                    Bug: { value: 'bug' },
                  },
                }),
                Bug: expect.objectContaining({
                  base: { namespace: '__unbound__', model: 'Task' },
                }),
                Comment: expect.objectContaining({
                  owner: 'Task',
                }),
              },
            },
          },
        },
      });

      const contractDts = readFileSync(contractDtsPath, 'utf-8');
      expect(contractDts).toContain("readonly owner: 'Task'");
      expect(contractDts).toMatch(/readonly base:\s*{\s*readonly namespace:/);
      expect(contractDts).toContain("readonly discriminator: { readonly field: 'type' }");
      expect(contractDts).toContain('readonly users: {');
      expect(contractDts).toContain('readonly indexes:');
      expect(contractDts).toContain("readonly kind: 'mongo-index'");
      expect(contractDts).toContain("readonly field: 'email'");
      expect(contractDts).toContain('readonly direction: 1');
      expect(contractDts).toContain('readonly unique: true');
      expect(contractDts).toContain('readonly options:');
      expect(contractDts).toContain("readonly kind: 'mongo-collection-options'");
      expect(contractDts).toContain("readonly kind: 'mongo-collation-options'");
      expect(contractDts).toContain("readonly locale: 'en'");
      expect(contractDts).toContain('readonly strength: 2');

      expect(run.presented?.data).toMatchObject({
        ok: true,
        storageHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        files: {
          json: expect.stringContaining('contract.json'),
          dts: expect.stringContaining('contract.d.ts'),
        },
      });
    } finally {
      testSetup.cleanup();
    }
  });
});
