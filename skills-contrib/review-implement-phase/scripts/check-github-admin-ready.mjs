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
  const result = { prUrl: null, help: false };
  if (args.includes('--help')) {
    result.help = true;
    return result;
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== '--pr') {
      throw { code: EXIT_CLI, message: `error: unknown flag "${arg}"` };
    }
    index += 1;
    if (index >= args.length) {
      throw { code: EXIT_CLI, message: 'error: --pr requires a value' };
    }
    result.prUrl = args[index];
  }
  if (!result.prUrl) {
    throw { code: EXIT_CLI, message: 'error: --pr is required' };
  }
  return result;
}

function getHelpText() {
  return [
    'Usage:',
    '  check-github-admin-ready.mjs --pr <PR_URL>',
    '',
    'Purpose:',
    '  Verify gh authentication + repo scopes and PR API access before implement phase.',
  ].join('\n');
}

function parsePrUrl(url) {
  const match = String(url)
    .trim()
    .match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/)?(?:#.*)?$/i);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    number: Number.parseInt(match[3], 10),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: SUBPROCESS_TIMEOUT_MS });
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`error: ${command} timed out after ${SUBPROCESS_TIMEOUT_MS / 1000} seconds`);
  }
  if (result.signal) {
    throw new Error(`error: ${command} was terminated by signal ${result.signal}`);
  }
  return result;
}

function hasRepoScope(output) {
  const scopeLine = output.split(/\r?\n/).find((line) => line.includes('Token scopes:'));
  if (!scopeLine) {
    return false;
  }
  return scopeLine
    .replace(/^.*Token scopes:\s*/u, '')
    .split(',')
    .map((scope) => scope.trim().replace(/^['"]|['"]$/g, ''))
    .includes('repo');
}

function assertCommandAvailable(command, installHint) {
  const probe = run(command, ['--version']);
  if (probe.error || probe.status !== 0) {
    throw new Error(
      `error: required dependency "${command}" is not available. Install ${installHint} and retry.`,
    );
  }
}

function assertGhAuthAndScopes() {
  const auth = run('gh', ['auth', 'status']);
  if (auth.error) {
    throw new Error(`error: failed to execute gh: ${auth.error.message}`);
  }
  if (auth.status !== 0) {
    throw new Error('error: gh is not authenticated; run `gh auth login`.');
  }
  const output = `${auth.stdout}\n${auth.stderr}`;
  if (!hasRepoScope(output)) {
    throw new Error('error: gh token is missing `repo` scope required for review thread admin.');
  }
}

function assertPrApiAccess(owner, repo, number) {
  const query =
    'query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id url state}}}';
  const result = run('gh', [
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `repo=${repo}`,
    '-F',
    `number=${number}`,
  ]);
  if (result.status !== 0) {
    throw new Error(
      `error: cannot access PR via gh api graphql: ${result.stderr || result.stdout}`.trim(),
    );
  }
}

async function main() {
  const args = parseCliArgs(process.argv);
  if (args.help) {
    process.stdout.write(`${getHelpText()}\n`);
    process.exit(EXIT_SUCCESS);
  }

  const parsed = parsePrUrl(args.prUrl);
  if (!parsed) {
    throw {
      code: EXIT_CLI,
      message: 'error: invalid PR URL (expected https://github.com/OWNER/REPO/pull/123)',
    };
  }

  assertCommandAvailable('gh', 'GitHub CLI (`gh`)');

  assertGhAuthAndScopes();
  assertPrApiAccess(parsed.owner, parsed.repo, parsed.number);
  process.stdout.write('ok: github admin preflight passed\n');
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
