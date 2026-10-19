import type { DiffableNode, SchemaDiffIssue } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { issueLabel, schemaCheckWhy, schemaIssuesWhy } from '../../src/utils/schema-issues';

const node: DiffableNode = {
  id: 'default',
  nodeKind: 'sql-column-default',
  isEqualTo: () => false,
  children: () => [],
};

const explained: SchemaDiffIssue = {
  path: ['public', 'event', 'at', 'default'],
  expected: node,
  actual: node,
  explanation: { text: 'The contract holds 1, and the database holds 2.', cause: 'differs' },
};
const plain: SchemaDiffIssue = { path: ['public', 'event', 'id'], expected: node };

describe('issueLabel', () => {
  it('names the outcome and the path', () => {
    expect(
      issueLabel({ path: ['public', 'event', 'at', 'default'], expected: node, actual: node }),
    ).toBe('mismatch: public/event/at/default');
  });

  it('adds the explanation a mismatch carries', () => {
    expect(issueLabel(explained)).toBe(
      'mismatch: public/event/at/default. The contract holds 1, and the database holds 2.',
    );
  });
});

describe('schemaIssuesWhy', () => {
  it('joins the labels after the opening without doubling a full stop', () => {
    expect(schemaIssuesWhy('The live schema differs', [explained, plain])).toBe(
      'The live schema differs: mismatch: public/event/at/default. The contract holds 1, and the database holds 2; missing: public/event/id.',
    );
  });
});

describe('schemaCheckWhy', () => {
  it('lists the issues of a failed schema check', () => {
    expect(schemaCheckWhy([explained, plain])).toBe(
      'The schema check after apply found: mismatch: public/event/at/default. The contract holds 1, and the database holds 2; missing: public/event/id.',
    );
  });

  it('gives nothing when the check reported no issues', () => {
    expect({ absent: schemaCheckWhy(undefined), empty: schemaCheckWhy([]) }).toEqual({
      absent: undefined,
      empty: undefined,
    });
  });
});
