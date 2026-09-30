import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { timeouts } from '@repo/test-utils';
import { dirname, join } from 'pathe';
import { expect, it, vi } from 'vitest';
import {
  createConnection,
  InitializeRequest,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver/node';
import { resolveSchemaInputs } from '../src/schema-inputs';
import { createServer } from '../src/server';

vi.mock('@internal/config-loader', async (original) => ({
  ...(await original<typeof import('@internal/config-loader')>()),
  findNearestConfigPathForFile: async (path: string) => join(dirname(path), 'prisma.config.ts'),
}));
vi.mock('../src/config-resolution', async (original) => ({
  ...(await original<typeof import('../src/config-resolution')>()),
  resolveConfigInputs: async (
    configPath: string,
    readText: (uri: string) => string | undefined,
  ) => {
    const schemaInputConfig = {
      contract: { source: { format: 'psl', inputs: [join(dirname(configPath), '*.prisma')] } },
    };
    return {
      schemaInputConfig,
      inputs: await resolveSchemaInputs(schemaInputConfig, readText),
      controlStack: { scalarTypes: ['Int'], pslBlockDescriptors: {} },
    };
  },
}));
it('publishes and clears diagnostics for an external edit without further editor messages', {
  timeout: timeouts.databaseOperation,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'server-internal-watch-'));
  const path = join(dir, 'schema.prisma');
  const uri = pathToFileURL(path).toString();
  const clean = '// use prisma-8\nmodel User {\n id Int\n}\n';
  await writeFile(path, clean);
  await writeFile(join(dir, 'prisma.config.ts'), 'config');
  const input = new PassThrough();
  const output = new PassThrough();
  const connection = createConnection(
    new StreamMessageReader(input),
    new StreamMessageWriter(output),
  );
  const client = createConnection(new StreamMessageReader(output), new StreamMessageWriter(input));
  const publish = vi.spyOn(connection, 'sendDiagnostics').mockResolvedValue(undefined);
  const register = vi.spyOn(connection.client, 'register');
  const server = createServer(connection);
  client.listen();
  try {
    await client.sendRequest(InitializeRequest.type, {
      processId: null,
      rootUri: null,
      capabilities: {},
    });
    await client.sendRequest('textDocument/foldingRange', { textDocument: { uri } });
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith({ uri, diagnostics: [] }));
    publish.mockClear();
    await writeFile(path, `${clean}\nmodel User {\n id Int\n}\n`);
    await vi.waitFor(
      () =>
        expect(publish).toHaveBeenCalledWith({
          uri,
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ code: 'PSL_DUPLICATE_DECLARATION' }),
          ]),
        }),
      { timeout: timeouts.databaseOperation },
    );
    publish.mockClear();
    await writeFile(path, clean);
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith({ uri, diagnostics: [] }), {
      timeout: timeouts.databaseOperation,
    });
    expect(register).not.toHaveBeenCalled();
  } finally {
    await server.dispose();
    client.dispose();
    input.destroy();
    output.destroy();
    await rm(dir, { recursive: true, force: true });
  }
});
