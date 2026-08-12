import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'resolve-review-thread.mjs');

async function createFakeGh() {
  const directory = await mkdtemp(join(tmpdir(), 'resolve-review-thread-test-'));
  const ghPath = join(directory, 'gh');
  await writeFile(
    ghPath,
    [
      '#!/usr/bin/env node',
      "if (process.argv[2] === '--version') {",
      "  process.stdout.write('gh version fake\\n');",
      '  process.exit(0);',
      '}',
      "process.stdout.write(process.env.FAKE_GH_STDOUT ?? '{}');",
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(ghPath, 0o755);
  return directory;
}

async function runResolve(args, fakeStdout) {
  const fakeGhDirectory = await createFakeGh();
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeGhDirectory}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_GH_STDOUT: fakeStdout,
    },
  });
}

test('rejects unknown CLI flags', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--bogus'], { encoding: 'utf8' });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown flag "--bogus"/);
});

test('rejects missing thread id', () => {
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--thread-node-id is required/);
});

test('reports malformed JSON responses', async () => {
  const result = await runResolve(['--thread-node-id', 'THREAD_1'], 'not json');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /failed to parse GraphQL response/);
});

test('reports GraphQL errors', async () => {
  const result = await runResolve(
    ['--thread-node-id', 'THREAD_1'],
    JSON.stringify({ errors: [{ message: 'Could not resolve thread' }] }),
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not resolve thread/);
});

test('reports unresolved mutation payloads', async () => {
  const result = await runResolve(
    ['--thread-node-id', 'THREAD_1'],
    JSON.stringify({
      data: {
        resolveReviewThread: {
          thread: { id: 'THREAD_1', isResolved: false },
        },
      },
    }),
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /thread was not resolved successfully/);
});

test('prints resolution payloads', async () => {
  const result = await runResolve(
    ['--thread-node-id', 'THREAD_1'],
    JSON.stringify({
      data: {
        resolveReviewThread: {
          thread: { id: 'THREAD_1', isResolved: true },
        },
      },
    }),
  );

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    threadNodeId: 'THREAD_1',
    resolvedThreadId: 'THREAD_1',
    isResolved: true,
  });
});
