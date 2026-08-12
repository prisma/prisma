import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReviewStateMarkdown } from './render-review-state.mjs';

function buildPayload() {
  return {
    version: 2,
    fetchedAt: '2026-01-01T00:00:00Z',
    sourceBranch: 'main',
    pr: { nodeId: 'PR_1', url: 'https://example.com/pr/1' },
    reviewThreads: [
      {
        threadKey: 'thread:THREAD_1',
        nodeId: 'THREAD_1',
        path: 'docs/a \\| b.md',
        isResolved: false,
        isOutdated: false,
        ordering: {},
        targetHint: { kind: 'review_thread', nodeId: 'THREAD_1' },
        isActionableCandidate: true,
        comments: [
          {
            nodeId: 'COMMENT_1',
            url: 'https://example.com/pr/1#discussion_r1',
            author: { login: 'reviewer' },
            createdAt: '2026-01-01T00:00:00Z',
            body: 'note ends with \\',
            reactionGroups: [],
          },
        ],
      },
    ],
    reviews: [],
    issueComments: [],
    targets: [],
  };
}

test('escapes backslashes before pipes in table cells', () => {
  const markdown = renderReviewStateMarkdown(buildPayload(), {
    sourcePath: 'wip/review-state.json',
  });

  assert.ok(
    markdown.includes('| THREAD_1 | docs/a \\\\\\| b.md |  | no | 1 | note ends with \\\\ |'),
    `expected escaped table row in:\n${markdown}`,
  );
});

test('renders sourcePath in the Source code span with literal backslashes and escaped pipes', () => {
  const markdown = renderReviewStateMarkdown(buildPayload(), {
    sourcePath: 'wip\\re|views\\review-state.json',
  });

  assert.ok(
    markdown.includes('Source: `wip\\re\\|views\\review-state.json`'),
    `expected code-span source in:\n${markdown}`,
  );
});

test('renders sourcePath containing a backtick as an intact code span', () => {
  const markdown = renderReviewStateMarkdown(buildPayload(), {
    sourcePath: 'wip/a`b/review-state.json',
  });

  assert.ok(
    markdown.includes('Source: ``wip/a`b/review-state.json``'),
    `expected fenced code-span source in:\n${markdown}`,
  );
});

test('pads the code span when sourcePath starts and ends with a backtick', () => {
  const markdown = renderReviewStateMarkdown(buildPayload(), {
    sourcePath: '`review-state.json`',
  });

  assert.ok(
    markdown.includes('Source: `` `review-state.json` ``'),
    `expected padded code-span source in:\n${markdown}`,
  );
});
