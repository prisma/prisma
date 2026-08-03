#!/usr/bin/env node

/**
 * Composes the version + dist-tag the publish workflow will use.
 *
 * The base version comes from the root `package.json` (the
 * source-of-truth introduced by the package.json-versioning refactor).
 * This script is responsible only for the suffix and dist-tag
 * appropriate to the GitHub event:
 *
 * - `push`              → if the root `version` changed in this push,
 *                          `<base>` (no suffix), dist-tag `latest`. This
 *                          is how a merged `chore(release): ...` PR
 *                          ships a stable release automatically.
 *                         Otherwise, `<base>-dev.N`, dist-tag `dev`
 *                          (N is the next available build number,
 *                          discovered by querying npm).
 * - `workflow_dispatch` → `<base>` (no suffix), dist-tag from
 *                          `INPUT_DIST_TAG` (defaults to `latest`).
 *                          Useful as a manual escape hatch (re-publish
 *                          after a transient failure, cut a beta).
 *
 * Outputs `version` and `tag` to `$GITHUB_OUTPUT` for downstream
 * workflow steps to consume.
 */

import { execFileSync, execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { assertCanonicalBase } from './determine-version-utils.ts';

const PACKAGE_NAME = process.argv[2] ?? '@internal/contract';

interface VersionResult {
  version: string;
  tag: string;
}

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

function readRootVersion(): string {
  const pkgPath = join(rootDir, 'package.json');
  const parsed = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: unknown };
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(
      `Root package.json (${pkgPath}) is missing a \`version\` field. ` +
        'The publish pipeline now reads the version directly from the workspace root; ' +
        'set it (e.g. `pnpm bump-minor`) before publishing.',
    );
  }
  return parsed.version;
}

function run(command: string): string | undefined {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return undefined;
  }
}

function getLatestDevVersion(): string | undefined {
  return run(`npm view "${PACKAGE_NAME}" dist-tags.dev`);
}

type PreviousVersionLookup =
  | { available: true; version: string | undefined }
  | { available: false };

/**
 * Reads the root `package.json` `version` at `PUSH_BEFORE_SHA` (the ref
 * that `main` pointed at *before* the push). Distinguishes "we
 * successfully read the previous file" (so the comparison is meaningful)
 * from "we couldn't" (shallow clone, missing SHA, etc.) so the caller
 * can fall back to the safe `dev` path on any I/O hiccup.
 */
function readPreviousRootVersion(): PreviousVersionLookup {
  const beforeSha = process.env.PUSH_BEFORE_SHA;
  if (!beforeSha || /^0+$/.test(beforeSha)) {
    return { available: false };
  }
  try {
    const json = execFileSync('git', ['show', `${beforeSha}:package.json`], {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(json) as { version?: unknown };
    return {
      available: true,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
    };
  } catch {
    return { available: false };
  }
}

function determineDevVersion(baseVersion: string): VersionResult {
  const latestDevVersion = getLatestDevVersion();
  let buildNumber = 1;

  if (latestDevVersion) {
    const devPattern = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/;
    const match = latestDevVersion.match(devPattern);

    if (match) {
      const [, devBase, build] = match;
      if (devBase === baseVersion) {
        buildNumber = Number.parseInt(build, 10) + 1;
      }
    }
  }

  return {
    version: `${baseVersion}-dev.${buildNumber}`,
    tag: 'dev',
  };
}

function writeGitHubOutput(result: VersionResult): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `version<<EOF\n${result.version}\nEOF\n`);
    appendFileSync(outputFile, `tag<<EOF\n${result.tag}\nEOF\n`);
  }
}

const eventName = process.env.GITHUB_EVENT_NAME;
const inputDistTag = process.env.INPUT_DIST_TAG;

const baseVersion = readRootVersion();
assertCanonicalBase(baseVersion);

console.log(`Event:                 ${eventName}`);
console.log(`Base version (root):   ${baseVersion}`);

let result: VersionResult;

switch (eventName) {
  case 'workflow_dispatch':
    // `??` is wrong here: an empty INPUT_DIST_TAG would slip through as
    // the dist-tag and cause `pnpm publish --tag ""` to fail downstream.
    // The workflow declares `dist-tag` with a `latest` default, so this
    // fallback is a defensive belt-and-braces.
    result = { version: baseVersion, tag: inputDistTag || 'latest' };
    break;

  case 'push': {
    // If the root `version` differs from what main was pointing at before
    // this push, the push contains a release bump — cut a stable release
    // automatically. Otherwise, produce the usual `<base>-dev.N` tarball.
    //
    // `available: false` (shallow clone, missing SHA) deliberately falls
    // through to the dev path: a transient git error must never silently
    // promote to `latest`.
    const previous = readPreviousRootVersion();
    const isReleaseBump = previous.available && previous.version !== baseVersion;
    if (isReleaseBump) {
      console.log(
        `Previous root version: ${previous.version ?? '(unset)'} → release bump detected.`,
      );
      result = { version: baseVersion, tag: 'latest' };
    } else {
      result = determineDevVersion(baseVersion);
    }
    break;
  }

  default:
    throw new Error(`don't know how to handle event ${eventName}`);
}

console.log(`Resolved version:      ${result.version}`);
console.log(`Resolved dist-tag:     ${result.tag}`);
writeGitHubOutput(result);
