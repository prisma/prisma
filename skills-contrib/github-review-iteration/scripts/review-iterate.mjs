#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILL_DIR = resolve(__dirname, '..');
const SKILLS_ROOT = resolve(SKILL_DIR, '..');

const EXIT_SUCCESS = 0;
const EXIT_OPERATIONAL = 1;
const EXIT_CLI = 2;
const DEFAULT_REVIEWS_ROOT = 'wip/reviews';

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const result = { prUrl: null, reviewsRoot: DEFAULT_REVIEWS_ROOT, help: false };
  if (args.includes('--help')) return { ...result, help: true };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if ((flag !== '--pr' && flag !== '--reviews-root') || !value) {
      throw { code: EXIT_CLI, message: `error: invalid args near "${flag ?? ''}"` };
    }
    if (flag === '--pr') result.prUrl = value;
    if (flag === '--reviews-root') result.reviewsRoot = value;
  }
  if (!result.prUrl) throw { code: EXIT_CLI, message: 'error: --pr is required' };
  return result;
}

function parsePrUrl(url) {
  const match = url
    .trim()
    .match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/)?(?:#.*)?$/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ''),
    number: Number.parseInt(match[3], 10),
  };
}

function deriveReviewDirectoryName(prUrl) {
  const parsed = parsePrUrl(prUrl);
  if (!parsed) throw new TypeError('error: invalid --pr value');
  return `${parsed.owner.toLowerCase()}_${parsed.repo.toLowerCase()}_pr-${parsed.number}`;
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`error: failed running ${scriptPath}`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const options = parseCliArgs(process.argv);
  if (options.help) {
    process.stdout.write('Usage: review-iterate.mjs --pr <url> [--reviews-root <dir>] [--help]\n');
    process.exit(EXIT_SUCCESS);
  }

  if (!parsePrUrl(options.prUrl)) {
    throw { code: EXIT_CLI, message: 'error: --pr must be a GitHub pull request URL' };
  }

  const directoryName = deriveReviewDirectoryName(options.prUrl);
  const reviewDir = resolve(options.reviewsRoot, directoryName);
  await mkdir(reviewDir, { recursive: true });

  const reviewStateJsonPath = resolve(reviewDir, 'review-state.json');
  const reviewStateMdPath = resolve(reviewDir, 'review-state.md');
  const reviewSummaryPath = resolve(reviewDir, 'summary.txt');
  const reviewActionsJsonPath = resolve(reviewDir, 'review-actions.json');
  const reviewActionsMdPath = resolve(reviewDir, 'review-actions.md');
  await mkdir(dirname(reviewStateJsonPath), { recursive: true });

  const fetchPhase = resolve(SKILLS_ROOT, 'review-fetch-phase/scripts');
  const triagePhase = resolve(SKILLS_ROOT, 'review-triage-phase/scripts');

  runNodeScript(resolve(fetchPhase, 'fetch-review-state.mjs'), [
    '--pr',
    options.prUrl,
    '--out-json',
    reviewStateJsonPath,
  ]);
  runNodeScript(resolve(fetchPhase, 'render-review-state.mjs'), [
    '--in',
    reviewStateJsonPath,
    '--out',
    reviewStateMdPath,
  ]);
  runNodeScript(resolve(fetchPhase, 'summarize-review-state.mjs'), [
    '--in',
    reviewStateJsonPath,
    '--format',
    'text',
    '--out',
    reviewSummaryPath,
  ]);

  if (await fileExists(reviewActionsJsonPath)) {
    runNodeScript(resolve(triagePhase, 'render-review-actions.mjs'), [
      '--in',
      reviewActionsJsonPath,
      '--out',
      reviewActionsMdPath,
    ]);
  }

  process.stdout.write(`${reviewDir}\n`);
}

const isMain =
  Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    const code = typeof error?.code === 'number' ? error.code : EXIT_OPERATIONAL;
    process.stderr.write(`${error?.message ? String(error.message) : String(error)}\n`);
    process.exit(code);
  });
}
