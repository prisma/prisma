#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_SUCCESS = 0;
const EXIT_OPERATIONAL = 1;
const EXIT_CLI = 2;
const SUBPROCESS_TIMEOUT_MS = 30_000;

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const result = { help: false, threadNodeId: null };
  if (args.includes('--help')) {
    result.help = true;
    return result;
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== '--thread-node-id') {
      throw { code: EXIT_CLI, message: `error: unknown flag "${arg}"` };
    }
    index += 1;
    if (index >= args.length) {
      throw { code: EXIT_CLI, message: 'error: --thread-node-id requires a value' };
    }
    result.threadNodeId = args[index];
  }
  if (!result.threadNodeId) {
    throw { code: EXIT_CLI, message: 'error: --thread-node-id is required' };
  }
  return result;
}

function getHelpText() {
  return [
    'Usage:',
    '  resolve-review-thread.mjs --thread-node-id <NODE_ID>',
    '',
    'Purpose:',
    '  Resolve a pull request review thread by node ID via GitHub GraphQL API.',
  ].join('\n');
}

function run(command, args, input = null) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input: input ?? undefined,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`error: ${command} timed out after ${SUBPROCESS_TIMEOUT_MS / 1000} seconds`);
    }
    throw new Error(`error: failed to execute ${command}: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`error: ${command} was terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `error: ${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`.trim(),
    );
  }
  return result.stdout;
}

function assertCommandAvailable(command, installHint) {
  const probe = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
  if (probe.error || probe.status !== 0) {
    if (probe.error?.code === 'ETIMEDOUT') {
      throw new Error(
        `error: required dependency "${command}" timed out after ${SUBPROCESS_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    if (probe.signal) {
      throw new Error(
        `error: required dependency "${command}" was terminated by signal ${probe.signal}.`,
      );
    }
    throw new Error(
      `error: required dependency "${command}" is not available. Install ${installHint} and retry.`,
    );
  }
}

function resolveThread(threadNodeId) {
  const mutation = [
    'mutation($threadId:ID!){',
    '  resolveReviewThread(input:{threadId:$threadId}){',
    '    thread {',
    '      id',
    '      isResolved',
    '    }',
    '  }',
    '}',
  ].join('\n');

  const response = run('gh', [
    'api',
    'graphql',
    '-f',
    `query=${mutation}`,
    '-F',
    `threadId=${threadNodeId}`,
  ]);

  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch (parseError) {
    throw new Error(`error: failed to parse GraphQL response: ${parseError.message}`);
  }

  if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
    const messages = parsed.errors
      .map((err) =>
        typeof err?.message === 'string' && err.message.length > 0
          ? err.message
          : JSON.stringify(err),
      )
      .join('; ');
    throw new Error(`error: ${messages}`);
  }

  const thread = parsed?.data?.resolveReviewThread?.thread;
  if (thread?.isResolved !== true) {
    throw new Error(
      `error: thread was not resolved successfully (isResolved=${thread?.isResolved === undefined ? 'null' : String(thread.isResolved)})`,
    );
  }

  return { resolvedThreadId: thread.id, isResolved: true };
}

async function main() {
  const args = parseCliArgs(process.argv);
  if (args.help) {
    process.stdout.write(`${getHelpText()}\n`);
    process.exit(EXIT_SUCCESS);
  }

  assertCommandAvailable('gh', 'GitHub CLI (`gh`)');

  const result = resolveThread(args.threadNodeId);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      threadNodeId: args.threadNodeId,
      resolvedThreadId: result.resolvedThreadId,
      isResolved: true,
    })}\n`,
  );
}

const isMain = (() => {
  try {
    const invokedScriptPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : null;
    const currentModulePath = realpathSync(fileURLToPath(import.meta.url));
    return invokedScriptPath !== null && invokedScriptPath === currentModulePath;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((error) => {
    const code = typeof error?.code === 'number' ? error.code : EXIT_OPERATIONAL;
    const message = error?.message ? String(error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(code);
  });
}
