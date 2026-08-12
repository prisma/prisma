#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_SUCCESS = 0;
const EXIT_OPERATIONAL = 1;
const EXIT_CLI = 2;
const SUBPROCESS_TIMEOUT_MS = 30_000;

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const result = {
    help: false,
    repo: null,
    prNumber: null,
    commentNodeId: null,
    body: null,
    bodyFile: null,
  };

  if (args.includes('--help')) {
    result.help = true;
    return result;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (
      arg !== '--repo' &&
      arg !== '--pr' &&
      arg !== '--comment-node-id' &&
      arg !== '--body' &&
      arg !== '--body-file'
    ) {
      throw { code: EXIT_CLI, message: `error: unknown flag "${arg}"` };
    }
    index += 1;
    if (index >= args.length) {
      throw { code: EXIT_CLI, message: `error: ${arg} requires a value` };
    }
    const value = args[index];
    if (arg === '--repo') result.repo = value;
    if (arg === '--pr') result.prNumber = value;
    if (arg === '--comment-node-id') result.commentNodeId = value;
    if (arg === '--body') result.body = value;
    if (arg === '--body-file') result.bodyFile = value;
  }

  if (!result.repo) {
    throw { code: EXIT_CLI, message: 'error: --repo is required (OWNER/REPO)' };
  }
  if (!result.prNumber || !/^[1-9]\d*$/.test(result.prNumber)) {
    throw {
      code: EXIT_CLI,
      message: 'error: --pr is required (positive integer pull request number; e.g. 123)',
    };
  }
  if (!result.commentNodeId) {
    throw { code: EXIT_CLI, message: 'error: --comment-node-id is required' };
  }
  if (result.body === null && result.bodyFile === null) {
    throw { code: EXIT_CLI, message: 'error: provide exactly one of --body or --body-file' };
  }
  if (result.body !== null && result.bodyFile !== null) {
    throw { code: EXIT_CLI, message: 'error: provide only one of --body or --body-file' };
  }

  return result;
}

function getHelpText() {
  return [
    'Usage:',
    '  post-review-thread-reply.mjs --repo <OWNER/REPO> --pr <NUMBER> --comment-node-id <NODE_ID> (--body <TEXT> | --body-file <PATH>)',
    '',
    'Purpose:',
    '  Post acknowledgement to a review-target node and exit with a JSON result.',
    '',
    '  Behaviour by node type (auto-detected via GraphQL):',
    '    * PullRequestReviewComment (inline thread comment, PRRC_…): post an inline',
    '      reply via repos/{repo}/pulls/{pr}/comments with in_reply_to.',
    '    * PullRequestReview (review body, PRR_…): review bodies do not accept inline',
    '      replies, so post a top-level PR issue comment via',
    '      repos/{repo}/issues/{pr}/comments. The response kind is "issue_comment".',
    '',
    '  Anything else exits with a clear "unsupported node kind" error.',
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
  if (probe.error || probe.status !== 0) {
    throw new Error(
      `error: required dependency "${command}" is not available. Install ${installHint} and retry.`,
    );
  }
}

function parseApiResponse(jsonText, contextDescription) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    throw new Error(`error: failed to parse ${contextDescription}: ${parseError.message}`);
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
  return parsed;
}

function resolveTargetNode(commentNodeId) {
  const query = [
    'query($id:ID!){',
    '  node(id:$id){',
    '    __typename',
    '    ... on PullRequestReviewComment {',
    '      databaseId',
    '      pullRequest { number repository { nameWithOwner } }',
    '    }',
    '    ... on PullRequestReview {',
    '      databaseId',
    '      pullRequest { number repository { nameWithOwner } }',
    '    }',
    '  }',
    '}',
  ].join('\n');
  const response = run('gh', [
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `id=${commentNodeId}`,
  ]);
  const parsed = parseApiResponse(response, 'GraphQL node lookup response');
  const node = parsed?.data?.node;
  if (!node || typeof node !== 'object') {
    throw new Error(`error: GraphQL node lookup returned no node for id ${commentNodeId}`);
  }
  const typename = node.__typename;
  const databaseId =
    typeof node.databaseId === 'number'
      ? node.databaseId
      : typeof node.databaseId === 'string' && node.databaseId.length > 0
        ? Number.parseInt(node.databaseId, 10)
        : null;
  if (typename !== 'PullRequestReviewComment' && typename !== 'PullRequestReview') {
    throw new Error(
      `error: unsupported node kind "${typename ?? 'unknown'}" for ${commentNodeId} (expected PullRequestReviewComment or PullRequestReview)`,
    );
  }
  if (databaseId === null || Number.isNaN(databaseId)) {
    throw new Error(`error: failed to resolve databaseId for ${typename} node ${commentNodeId}`);
  }
  const repo =
    typeof node.pullRequest?.repository?.nameWithOwner === 'string'
      ? node.pullRequest.repository.nameWithOwner
      : null;
  const prNumber = typeof node.pullRequest?.number === 'number' ? node.pullRequest.number : null;
  if (!repo || prNumber === null) {
    throw new Error(
      `error: GraphQL node lookup did not return owning repo and PR for ${commentNodeId}`,
    );
  }
  return { kind: typename, databaseId, repo, prNumber };
}

function assertNodeBelongsTo(target, expectedRepo, expectedPrNumber, commentNodeId) {
  if (target.repo.toLowerCase() !== expectedRepo.toLowerCase()) {
    throw new Error(
      `error: ${commentNodeId} belongs to ${target.repo}#${target.prNumber}, not ${expectedRepo}#${expectedPrNumber}`,
    );
  }
  if (target.prNumber !== expectedPrNumber) {
    throw new Error(
      `error: ${commentNodeId} belongs to ${target.repo}#${target.prNumber}, not ${expectedRepo}#${expectedPrNumber}`,
    );
  }
}

function readBody(body, bodyFile) {
  if (body !== null) {
    return body;
  }
  return readFileSync(resolve(bodyFile), 'utf8');
}

function postInlineReply(repo, prNumber, body, inReplyToDatabaseId) {
  const response = run('gh', [
    'api',
    `repos/${repo}/pulls/${prNumber}/comments`,
    '--method',
    'POST',
    '-f',
    `body=${body}`,
    '-F',
    `in_reply_to=${inReplyToDatabaseId}`,
  ]);
  const parsed = parseApiResponse(response, 'inline-reply REST response');
  if (typeof parsed?.id !== 'number') {
    throw new Error('error: reply was posted but response did not include a numeric comment id');
  }
  return parsed.id;
}

function postIssueComment(repo, prNumber, body) {
  const response = run('gh', [
    'api',
    `repos/${repo}/issues/${prNumber}/comments`,
    '--method',
    'POST',
    '-f',
    `body=${body}`,
  ]);
  const parsed = parseApiResponse(response, 'issue-comment REST response');
  if (typeof parsed?.id !== 'number') {
    throw new Error(
      'error: top-level PR comment was posted but response did not include a numeric comment id',
    );
  }
  return parsed.id;
}

async function main() {
  const args = parseCliArgs(process.argv);
  if (args.help) {
    process.stdout.write(`${getHelpText()}\n`);
    process.exit(EXIT_SUCCESS);
  }

  assertCommandAvailable('gh', 'GitHub CLI (`gh`)');

  const target = resolveTargetNode(args.commentNodeId);
  assertNodeBelongsTo(target, args.repo, Number.parseInt(args.prNumber, 10), args.commentNodeId);
  const body = readBody(args.body, args.bodyFile);

  if (target.kind === 'PullRequestReviewComment') {
    const replyId = postInlineReply(args.repo, args.prNumber, body, target.databaseId);
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        kind: 'review_thread_reply',
        replyCommentId: replyId,
        inReplyTo: target.databaseId,
        commentNodeId: args.commentNodeId,
      })}\n`,
    );
    return;
  }

  const issueCommentId = postIssueComment(args.repo, args.prNumber, body);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      kind: 'issue_comment',
      issueCommentId,
      reviewDatabaseId: target.databaseId,
      commentNodeId: args.commentNodeId,
      note: 'PullRequestReview targets do not accept inline replies; posted a top-level PR issue comment instead.',
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
