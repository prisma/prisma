import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReviewActionsMarkdown } from './render-review-actions.mjs';

function buildPayload() {
  return {
    version: 2,
    pr: { url: 'https://example.com/pr/1' },
    reviewState: {
      path: 'wip/review-state.json',
      fetchedAt: '2026-01-01T00:00:00Z',
      version: 2,
    },
    actions: [
      {
        actionId: 'A1',
        target: {
          kind: 'review_thread',
          nodeId: 'THREAD_1',
          url: 'https://example.com/pr/1#discussion_r1',
        },
        decision: 'will_address',
        summary: 'fix foo \\| bar',
        targetFiles: ['src/a.ts'],
        acceptance: 'trailing \\',
        status: 'pending',
      },
    ],
  };
}

test('escapes backslashes before pipes in table cells', () => {
  const markdown = renderReviewActionsMarkdown(buildPayload(), {
    sourcePath: 'wip/review-actions.json',
  });

  assert.ok(markdown.includes('fix foo \\\\\\| bar'), `expected escaped summary in:\n${markdown}`);
  assert.ok(markdown.includes('trailing \\\\ |'), `expected escaped acceptance in:\n${markdown}`);
});

test('renders sourcePath and target-file code spans with literal backslashes and escaped pipes', () => {
  const payload = buildPayload();
  payload.actions[0].targetFiles = ['src\\win|dows\\a.ts'];

  const markdown = renderReviewActionsMarkdown(payload, {
    sourcePath: 'wip\\review-actions.json',
  });

  assert.ok(
    markdown.includes('Source: `wip\\review-actions.json`'),
    `expected code-span source in:\n${markdown}`,
  );
  assert.ok(
    markdown.includes('`src\\win\\|dows\\a.ts`'),
    `expected code-span target file in:\n${markdown}`,
  );
});

test('renders a target file containing a backtick as an intact code span', () => {
  const payload = buildPayload();
  payload.actions[0].targetFiles = ['src/a`b.ts'];

  const markdown = renderReviewActionsMarkdown(payload, {
    sourcePath: 'wip/review-actions.json',
  });

  assert.ok(
    markdown.includes('``src/a`b.ts``'),
    `expected fenced code-span target file in:\n${markdown}`,
  );
});

test('pads the code span when a target file starts and ends with a backtick', () => {
  const payload = buildPayload();
  payload.actions[0].targetFiles = ['`a.ts`'];

  const markdown = renderReviewActionsMarkdown(payload, {
    sourcePath: 'wip/review-actions.json',
  });

  assert.ok(markdown.includes('`` `a.ts` ``'), `expected padded code span in:\n${markdown}`);
});
