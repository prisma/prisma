import type { DiffableNode, SchemaDiffIssue } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { schemaDriftNextActions } from '../../src/orm/db/verification';

const node: DiffableNode = {
  id: 'default',
  nodeKind: 'sql-column-default',
  isEqualTo: () => false,
  children: () => [],
};

describe('schemaDriftNextActions', () => {
  it('offers db update, then a change to the contract source, for db sign', () => {
    expect(schemaDriftNextActions({ verb: 'sign', contractRef: undefined, issues: [] })).toEqual([
      {
        kind: 'run-command',
        label: 'Change the database to match the contract, then sign again',
        command: '{bin} db update',
      },
      {
        kind: 'user-choice',
        label:
          'Or change the contract source to describe the database as it is, re-run contract emit, then sign again',
      },
    ]);
  });

  it('says verify again for db verify', () => {
    expect(schemaDriftNextActions({ verb: 'verify', contractRef: undefined, issues: [] })).toEqual([
      {
        kind: 'run-command',
        label: 'Change the database to match the contract, then verify again',
        command: '{bin} db update',
      },
      {
        kind: 'user-choice',
        label:
          'Or change the contract source to describe the database as it is, re-run contract emit, then verify again',
      },
    ]);
  });

  it('aims db update at the ref being signed, and the contract change at the emitted contract', () => {
    expect(schemaDriftNextActions({ verb: 'sign', contractRef: 'staging', issues: [] })).toEqual([
      {
        kind: 'run-command',
        label: 'Change the database to match the contract, then sign again',
        command: '{bin} db update --to "staging"',
      },
      {
        kind: 'user-choice',
        label:
          'Or change the contract source to describe the database as it is, re-run contract emit, then sign the emitted contract instead of "staging"',
      },
    ]);
  });

  it('offers only re-emitting when a sign of a snapshot finds a refused contract value', () => {
    expect(
      schemaDriftNextActions({
        verb: 'sign',
        contractRef: 'staging',
        issues: [
          {
            path: ['public', 'event', 'at', 'default'],
            expected: node,
            explanation: 'Re-emit the contract, then try again.',
            explanationCause: 'expected-refused',
          },
        ],
      }),
    ).toEqual([
      {
        kind: 'run-command',
        label: 'Re-emit the contract, which stores the refused default as its type holds it',
        command: '{bin} contract emit',
      },
    ]);
  });

  it('offers only re-emitting the contract when an issue explains a refused contract value', () => {
    expect(
      schemaDriftNextActions({
        verb: 'verify',
        contractRef: undefined,
        issues: [
          { path: ['public', 'event', 'at', 'default'], expected: node },
          {
            path: ['public', 'event', 'at', 'default'],
            expected: node,
            explanation: 'Re-emit the contract, then try again.',
            explanationCause: 'expected-refused',
          },
        ],
      }),
    ).toEqual([
      {
        kind: 'run-command',
        label: 'Re-emit the contract, which stores the refused default as its type holds it',
        command: '{bin} contract emit',
      },
    ]);
  });

  describe('a default the database may store in its own form', () => {
    const equivalentForm: SchemaDiffIssue = {
      path: ['public', 'event', 'at', 'default'],
      expected: node,
      actual: node,
      explanation: 'The database stores this default as `(now())`.',
      explanationCause: 'equivalent-form',
    };
    const refused: SchemaDiffIssue = {
      path: ['public', 'event', 'on', 'default'],
      expected: node,
      explanation: 'Re-emit the contract, then try again.',
      explanationCause: 'expected-refused',
    };
    const plain: SchemaDiffIssue = { path: ['public', 'event', 'id'], expected: node };

    it('offers only changing the contract to match the database', () => {
      expect(
        schemaDriftNextActions({
          verb: 'verify',
          contractRef: undefined,
          issues: [equivalentForm],
        }),
      ).toEqual([
        {
          kind: 'user-choice',
          label:
            'Change the contract source to match the database, as the issue says, re-run contract emit, then verify again',
        },
      ]);
    });

    it('aims the contract change at the emitted contract when signing a ref', () => {
      expect(
        schemaDriftNextActions({ verb: 'sign', contractRef: 'staging', issues: [equivalentForm] }),
      ).toEqual([
        {
          kind: 'user-choice',
          label:
            'Change the contract source to match the database, as the issue says, re-run contract emit, then sign the emitted contract instead of "staging"',
        },
      ]);
    });

    it('adds the normal drift actions when another issue has no explanation', () => {
      expect(
        schemaDriftNextActions({
          verb: 'verify',
          contractRef: undefined,
          issues: [equivalentForm, plain],
        }),
      ).toEqual([
        {
          kind: 'user-choice',
          label:
            'Change the contract source to match the database, as the issue says, re-run contract emit, then verify again',
        },
        {
          kind: 'run-command',
          label: 'Change the database to match the contract, then verify again',
          command: '{bin} db update',
        },
        {
          kind: 'user-choice',
          label:
            'Or change the contract source to describe the database as it is, re-run contract emit, then verify again',
        },
      ]);
    });

    it('offers re-emitting first, then the contract change, when a contract value is also refused', () => {
      expect(
        schemaDriftNextActions({
          verb: 'verify',
          contractRef: undefined,
          issues: [equivalentForm, refused, plain],
        }),
      ).toEqual([
        {
          kind: 'run-command',
          label: 'Re-emit the contract, which stores the refused default as its type holds it',
          command: '{bin} contract emit',
        },
        {
          kind: 'user-choice',
          label:
            'Change the contract source to match the database, as the issue says, re-run contract emit, then verify again',
        },
      ]);
    });
  });
});
