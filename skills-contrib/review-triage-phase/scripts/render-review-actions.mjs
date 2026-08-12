#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReviewActionsV1 } from './review-artifacts.mjs';

const EXIT_SUCCESS = 0;
const EXIT_OPERATIONAL = 1;
const EXIT_CLI = 2;

function getHelpText() {
  return [
    'Usage:',
    '  render-review-actions.mjs --in <review-actions.json> [--out <review-actions.md>|-] [--view will-address|all] [--help]',
    '',
    'Purpose:',
    '  Render deterministic Markdown (review-actions.md) from review-actions.json.',
    '',
    'Flags:',
    '  --in <path.json>       Input path to review-actions.json.',
    '  --out <path.md>|-      Markdown output path. Use "-" to write to stdout. Defaults to stdout.',
    '  --view will-address|all',
    '                         Render all actions (default) or only will-address actions.',
    '  --help                 Show this help text and exit.',
  ].join('\n');
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const result = { inPath: null, outPath: null, view: 'all', help: false };
  if (args.includes('--help')) {
    result.help = true;
    return result;
  }
  const knownFlags = new Set(['--in', '--out', '--view']);
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      throw { code: EXIT_CLI, message: `error: unknown flag "${arg}"` };
    }
    const flag = arg;
    if (!knownFlags.has(flag)) {
      throw { code: EXIT_CLI, message: `error: unknown flag "${flag}"` };
    }
    i++;
    if (i >= args.length) {
      throw {
        code: EXIT_CLI,
        message: `error: ${flag} requires a value`,
      };
    }
    const value = args[i];
    i++;
    if (flag === '--in') {
      result.inPath = value;
    } else if (flag === '--out') {
      result.outPath = value;
    } else if (flag === '--view') {
      result.view = value;
    }
  }
  if (!result.inPath) {
    throw { code: EXIT_CLI, message: 'error: --in is required' };
  }
  if (result.inPath === '-') {
    throw { code: EXIT_CLI, message: 'error: --in - is not supported' };
  }
  if (!result.inPath.endsWith('.json')) {
    throw { code: EXIT_CLI, message: 'error: --in file path must end with .json' };
  }
  if (result.outPath !== null && result.outPath !== '-' && !result.outPath.endsWith('.md')) {
    throw { code: EXIT_CLI, message: 'error: --out file path must end with .md' };
  }
  if (result.view !== 'will-address' && result.view !== 'all') {
    throw { code: EXIT_CLI, message: 'error: --view must be will-address or all' };
  }
  return result;
}

function escapeTableCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCodeSpan(value) {
  const text = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
  const longestBacktickRun = (text.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  const fence = '`'.repeat(longestBacktickRun + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function formatCodePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return '';
  return paths.map((p) => formatCodeSpan(p)).join(', ');
}

function computeStatus(actions) {
  const statuses = new Set((actions ?? []).map((a) => a?.status).filter(Boolean));
  if (statuses.size === 0) return 'Triaged';
  if (statuses.has('in_progress')) return 'In progress';
  if (statuses.size === 1 && statuses.has('done')) return 'Complete';
  if (statuses.size === 1 && statuses.has('pending')) return 'Triaged';
  return 'In progress';
}

function formatTarget(target) {
  const kind = escapeTableCell(target?.kind);
  const nodeId = escapeTableCell(target?.nodeId);
  return `${kind} / ${nodeId}`;
}

export function renderReviewActionsMarkdown(payload, { sourcePath }) {
  assertReviewActionsV1(payload);

  const prUrl = payload?.pr?.url ?? '';
  const source = formatCodeSpan(sourcePath || 'review-actions.json');
  const actions = Array.isArray(payload?.actions) ? payload.actions : [];
  const view = payload?.meta?.renderView === 'will-address' ? 'will-address' : 'all';
  const includedActions =
    view === 'all' ? actions : actions.filter((action) => action?.decision === 'will_address');

  const lines = [];
  lines.push('# Review Actions');
  lines.push('');
  lines.push(`PR: ${escapeTableCell(prUrl)}`);
  lines.push(`Source: ${source}`);
  lines.push('');
  lines.push(`Status: ${computeStatus(includedActions)}`);
  lines.push('');
  lines.push(
    view === 'all'
      ? 'All actions are listed below.'
      : 'Only items triaged as **WILL ADDRESS** are listed below.',
  );
  lines.push('');
  lines.push(
    '| Action ID | Decision | Target | Link | Action | Target files | Acceptance check | Status |',
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const action of includedActions) {
    const actionId = action?.actionId ?? '';
    const decision = action?.decision ?? '';
    const target = formatTarget(action?.target);
    const link = action?.target?.url ?? '';
    const summary = action?.summary ?? '';
    const targetFiles = formatCodePaths(action?.targetFiles);
    const acceptance = action?.acceptance ?? '';
    const status = action?.status ?? '';

    lines.push(
      [
        escapeTableCell(actionId),
        escapeTableCell(decision),
        target,
        escapeTableCell(link),
        escapeTableCell(summary || '(pending triage)'),
        targetFiles,
        escapeTableCell(acceptance || ''),
        escapeTableCell(status),
      ]
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    );
  }

  return `${lines.join('\n')}\n`;
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function writeOutput(outPath, text) {
  if (!outPath || outPath === '-') {
    process.stdout.write(text);
    if (!text.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${text.endsWith('\n') ? text : `${text}\n`}`, 'utf8');
}

async function main() {
  const args = parseCliArgs(process.argv);
  if (args.help) {
    process.stdout.write(`${getHelpText()}\n`);
    process.exit(EXIT_SUCCESS);
  }

  const payload = await readJson(args.inPath);
  const markdown = renderReviewActionsMarkdown(
    { ...payload, meta: { ...(payload.meta ?? {}), renderView: args.view } },
    { sourcePath: args.inPath },
  );
  await writeOutput(args.outPath, markdown);
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
