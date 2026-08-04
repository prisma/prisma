import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import * as vite7 from 'vite7';
import * as vite8 from 'vite8';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fixtureAppDir,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { replaceInFileOrThrow } from './utils/contract-fixture-editing';

const tsFixtureSubdir = 'vite-plugin';
const pslFixtureSubdir = 'vite-plugin-psl';

const POSTGRES_DEFAULT_NAMESPACE = 'public';

function unboundUserColumns(storage: {
  namespaces: Record<
    string,
    { entries: { table: { user: { columns: Record<string, unknown> } } } }
  >;
}) {
  return storage.namespaces[POSTGRES_DEFAULT_NAMESPACE]!.entries.table.user.columns;
}

type ViteModuleNodeLike = object;

interface ViteServerLike {
  close(): Promise<void>;
  readonly ws: {
    send(...args: readonly unknown[]): void;
  };
  readonly watcher: {
    emit(...args: readonly unknown[]): boolean;
  };
  readonly moduleGraph: {
    getModulesByFile(filePath: string): Iterable<ViteModuleNodeLike> | undefined;
    invalidateModule(moduleNode: ViteModuleNodeLike, ...args: readonly unknown[]): void;
  };
}

type CreateServerLike = (config: {
  root: string;
  logLevel: 'silent';
  server: {
    middlewareMode: true;
  };
}) => Promise<ViteServerLike>;

async function waitForFileChange(
  filePath: string,
  originalMtime: number | null,
  timeoutMs: number,
): Promise<boolean> {
  const startTime = Date.now();
  const pollIntervalMs = 50;

  while (Date.now() - startTime < timeoutMs) {
    if (existsSync(filePath)) {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));
      const currentMtime = stats.mtimeMs;
      if (originalMtime === null || currentMtime > originalMtime) {
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

async function readJsonFileWhenReady(filePath: string, timeoutMs: number): Promise<string> {
  const startTime = Date.now();
  const pollIntervalMs = 50;
  let lastError: unknown;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const contents = readFileSync(filePath, 'utf-8');
      JSON.parse(contents);
      return contents;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for valid JSON in ${filePath}`);
}

function copyFixtureFiles(
  testDir: string,
  fixtureSubdir: string,
  fileNames: readonly string[],
): void {
  for (const fileName of fileNames) {
    copyFileSync(join(fixtureAppDir, 'fixtures', fixtureSubdir, fileName), join(testDir, fileName));
  }
}

interface SendSpyLike {
  readonly mock: {
    readonly calls: ReadonlyArray<ReadonlyArray<unknown>>;
  };
}

function hasWsMessageType(payload: unknown, messageType: string): boolean {
  if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
    return false;
  }

  return typeof payload.type === 'string' && payload.type === messageType;
}

async function waitForWsMessageType(
  sendSpy: SendSpyLike,
  messageType: string,
  timeoutMs: number,
): Promise<void> {
  const startTime = Date.now();
  const pollIntervalMs = 25;

  while (Date.now() - startTime < timeoutMs) {
    if (sendSpy.mock.calls.some(([payload]) => hasWsMessageType(payload, messageType))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for Vite ws message "${messageType}"`);
}

function runVitePluginHmrSuite(viteVersionLabel: string, createViteServer: CreateServerLike): void {
  withTempDir(({ createTempDir }) => {
    describe(`Vite plugin HMR (e2e, ${viteVersionLabel})`, () => {
      let server: ViteServerLike | null = null;

      afterEach(async () => {
        if (server) {
          await server.close();
          server = null;
        }
        vi.restoreAllMocks();
      });

      it(
        're-emits contract when contract.ts is modified',
        async () => {
          const testSetup = setupTestDirectoryFromFixtures(createTempDir, tsFixtureSubdir);
          const testDir = testSetup.testDir;
          const outputDir = testSetup.outputDir;
          const contractPath = testSetup.contractPath;

          copyFixtureFiles(testDir, tsFixtureSubdir, ['vite.config.ts']);

          const contractJsonPath = join(outputDir, 'contract.json');

          server = await createViteServer({
            root: testDir,
            logLevel: 'silent',
            server: {
              middlewareMode: true,
            },
          });

          const initialEmitSuccess = await waitForFileChange(
            contractJsonPath,
            null,
            timeouts.typeScriptCompilation,
          );
          expect(initialEmitSuccess).toBe(true);

          const initialContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(initialContract.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        email: expect.anything(),
                      },
                    },
                  },
                },
              },
            },
          });

          const sendSpy = vi.spyOn(server.ws, 'send');

          replaceInFileOrThrow(
            contractPath,
            '        email: field.column(textColumn),\n',
            '        email: field.column(textColumn),\n        name: field.column(textColumn).optional(),\n',
          );

          const contractModules = server.moduleGraph.getModulesByFile(contractPath);
          if (contractModules) {
            for (const module of contractModules) {
              server.moduleGraph.invalidateModule(module);
            }
          }
          server.watcher.emit('change', contractPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const updatedContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(updatedContract.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        name: { nullable: true },
                      },
                    },
                  },
                },
              },
            },
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        're-emits contract when contract.prisma is modified',
        async () => {
          const testSetup = setupTestDirectoryFromFixtures(createTempDir, pslFixtureSubdir);
          const testDir = testSetup.testDir;
          const outputDir = testSetup.outputDir;
          const schemaPath = join(testDir, 'contract.prisma');
          const contractJsonPath = join(outputDir, 'contract.json');

          copyFixtureFiles(testDir, pslFixtureSubdir, [
            'vite.config.ts',
            'contract.prisma',
            'contract-alt.prisma',
          ]);

          server = await createViteServer({
            root: testDir,
            logLevel: 'silent',
            server: {
              middlewareMode: true,
            },
          });

          const initialEmitSuccess = await waitForFileChange(
            contractJsonPath,
            null,
            timeouts.typeScriptCompilation,
          );
          expect(initialEmitSuccess).toBe(true);

          const initialContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(initialContract.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        email: expect.anything(),
                      },
                    },
                  },
                },
              },
            },
          });
          expect(unboundUserColumns(initialContract.storage)).not.toHaveProperty('name');

          const sendSpy = vi.spyOn(server.ws, 'send');

          replaceInFileOrThrow(schemaPath, '  email String\n', '  email String\n  name  String?\n');

          server.watcher.emit('change', schemaPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const updatedContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(updatedContract.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        name: { nullable: true },
                      },
                    },
                  },
                },
              },
            },
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        're-emits contract when config changes the authoritative inputs',
        async () => {
          const testSetup = setupTestDirectoryFromFixtures(createTempDir, pslFixtureSubdir);
          const testDir = testSetup.testDir;
          const outputDir = testSetup.outputDir;
          const configPath = testSetup.configPath;
          const altSchemaPath = join(testDir, 'contract-alt.prisma');
          const contractJsonPath = join(outputDir, 'contract.json');

          copyFixtureFiles(testDir, pslFixtureSubdir, [
            'vite.config.ts',
            'contract.prisma',
            'contract-alt.prisma',
          ]);

          server = await createViteServer({
            root: testDir,
            logLevel: 'silent',
            server: {
              middlewareMode: true,
            },
          });

          const initialEmitSuccess = await waitForFileChange(
            contractJsonPath,
            null,
            timeouts.typeScriptCompilation,
          );
          expect(initialEmitSuccess).toBe(true);

          const initialContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(unboundUserColumns(initialContract.storage)).not.toHaveProperty('name');

          const sendSpy = vi.spyOn(server.ws, 'send');

          replaceInFileOrThrow(configPath, './contract.prisma', './contract-alt.prisma');

          const configModules = server.moduleGraph.getModulesByFile(configPath);
          if (configModules) {
            for (const module of configModules) {
              server.moduleGraph.invalidateModule(module);
            }
          }
          server.watcher.emit('change', configPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const contractAfterConfigChange = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(contractAfterConfigChange.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        name: { nullable: true },
                      },
                    },
                  },
                },
              },
            },
          });

          sendSpy.mockClear();

          replaceInFileOrThrow(
            altSchemaPath,
            '  name  String?\n',
            '  name  String?\n  nickname String?\n',
          );

          server.watcher.emit('change', altSchemaPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const contractAfterAltEdit = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(contractAfterAltEdit.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        nickname: { nullable: true },
                      },
                    },
                  },
                },
              },
            },
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        'preserves the last good artifacts after a bad PSL edit and recovers on the next good edit',
        async () => {
          const testSetup = setupTestDirectoryFromFixtures(createTempDir, pslFixtureSubdir);
          const testDir = testSetup.testDir;
          const outputDir = testSetup.outputDir;
          const schemaPath = join(testDir, 'contract.prisma');
          const contractJsonPath = join(outputDir, 'contract.json');
          const contractDtsPath = join(outputDir, 'contract.d.ts');

          copyFixtureFiles(testDir, pslFixtureSubdir, [
            'vite.config.ts',
            'contract.prisma',
            'contract-alt.prisma',
          ]);

          server = await createViteServer({
            root: testDir,
            logLevel: 'silent',
            server: {
              middlewareMode: true,
            },
          });

          const [initialJsonEmitSuccess, initialDtsEmitSuccess] = await Promise.all([
            waitForFileChange(contractJsonPath, null, timeouts.typeScriptCompilation),
            waitForFileChange(contractDtsPath, null, timeouts.typeScriptCompilation),
          ]);
          expect(initialJsonEmitSuccess).toBe(true);
          expect(initialDtsEmitSuccess).toBe(true);

          const initialContractJson = await readJsonFileWhenReady(
            contractJsonPath,
            timeouts.typeScriptCompilation,
          );
          const initialContractDts = readFileSync(contractDtsPath, 'utf-8');
          const initialContract = JSON.parse(initialContractJson);
          expect(unboundUserColumns(initialContract.storage)).not.toHaveProperty('name');

          const { stat } = await import('node:fs/promises');
          const [initialJsonStats, initialDtsStats] = await Promise.all([
            stat(contractJsonPath),
            stat(contractDtsPath),
          ]);
          const sendSpy = vi.spyOn(server.ws, 'send');

          // Introduce a PSL error and confirm the previous successful emit stays on disk.
          replaceInFileOrThrow(
            schemaPath,
            '  email String\n\n  @@map("user")\n',
            '  email String\n  @@broken\n\n  @@map("user")\n',
          );

          server.watcher.emit('change', schemaPath);

          await waitForWsMessageType(sendSpy, 'error', timeouts.typeScriptCompilation);

          const [jsonStatsAfterBadEdit, dtsStatsAfterBadEdit] = await Promise.all([
            stat(contractJsonPath),
            stat(contractDtsPath),
          ]);
          expect(jsonStatsAfterBadEdit.mtimeMs).toBe(initialJsonStats.mtimeMs);
          expect(dtsStatsAfterBadEdit.mtimeMs).toBe(initialDtsStats.mtimeMs);
          expect(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          ).toBe(initialContractJson);
          expect(readFileSync(contractDtsPath, 'utf-8')).toBe(initialContractDts);

          // Fix the schema and wait for the next valid emit to replace both artifacts.
          sendSpy.mockClear();

          replaceInFileOrThrow(
            schemaPath,
            '  email String\n  @@broken\n\n  @@map("user")\n',
            '  email String\n  name  String?\n\n  @@map("user")\n',
          );

          server.watcher.emit('change', schemaPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const recoveredContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          expect(recoveredContract.storage).toMatchObject({
            namespaces: {
              [POSTGRES_DEFAULT_NAMESPACE]: {
                entries: {
                  table: {
                    user: {
                      columns: {
                        name: { nullable: true },
                      },
                    },
                  },
                },
              },
            },
          });
          expect(readFileSync(contractDtsPath, 'utf-8')).not.toBe(initialContractDts);
        },
        timeouts.spinUpPpgDev + timeouts.typeScriptCompilation * 2,
      );

      it(
        'last edit wins when two saves arrive in rapid succession',
        async () => {
          const testSetup = setupTestDirectoryFromFixtures(createTempDir, pslFixtureSubdir);
          const testDir = testSetup.testDir;
          const outputDir = testSetup.outputDir;
          const schemaPath = join(testDir, 'contract.prisma');
          const contractJsonPath = join(outputDir, 'contract.json');

          copyFixtureFiles(testDir, pslFixtureSubdir, [
            'vite.config.ts',
            'contract.prisma',
            'contract-alt.prisma',
          ]);

          server = await createViteServer({
            root: testDir,
            logLevel: 'silent',
            server: {
              middlewareMode: true,
            },
          });

          const initialEmitSuccess = await waitForFileChange(
            contractJsonPath,
            null,
            timeouts.typeScriptCompilation,
          );
          expect(initialEmitSuccess).toBe(true);

          const sendSpy = vi.spyOn(server.ws, 'send');

          // First save: introduce `name`. Trigger the emit immediately.
          replaceInFileOrThrow(
            schemaPath,
            '  email String\n\n  @@map("user")\n',
            '  email String\n  name String?\n\n  @@map("user")\n',
          );
          server.watcher.emit('change', schemaPath);

          // Second save: replace `name` with `nickname` before the first emit
          // completes. The plugin must guarantee that the LAST edit wins on disk
          // (whether via queue+coalesce or via cancel-and-restart — the
          // user-visible invariant is the same).
          replaceInFileOrThrow(
            schemaPath,
            '  email String\n  name String?\n\n  @@map("user")\n',
            '  email String\n  nickname String?\n\n  @@map("user")\n',
          );
          server.watcher.emit('change', schemaPath);

          await waitForWsMessageType(sendSpy, 'full-reload', timeouts.typeScriptCompilation);

          const finalContract = JSON.parse(
            await readJsonFileWhenReady(contractJsonPath, timeouts.typeScriptCompilation),
          );
          const finalUserColumns = unboundUserColumns(finalContract.storage);
          expect(finalUserColumns).toHaveProperty('nickname');
          expect(finalUserColumns).not.toHaveProperty('name');
        },
        timeouts.spinUpPpgDev + timeouts.typeScriptCompilation,
      );
    });
  });
}

runVitePluginHmrSuite('Vite 7', (config) => vite7.createServer(config));
runVitePluginHmrSuite('Vite 8', (config) => vite8.createServer(config));
