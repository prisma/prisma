import type {
  DiffableNode,
  ExpectationFailureReason,
  SchemaDiffIssue,
} from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import {
  classifyMongoDiffIssue,
  verifierDisposition,
} from '../src/core/schema-verify/verifier-disposition';

const NODE: DiffableNode = {
  id: 'x',
  nodeKind: 'mongo',
  isEqualTo: () => true,
  children: () => [],
};

/** Stamps `expected`/`actual` so the issue's change kind derives from presence. */
function withPresence(path: readonly string[], change: ExpectationFailureReason): SchemaDiffIssue {
  return {
    path,
    ...(change !== 'not-expected' ? { expected: NODE } : {}),
    ...(change !== 'not-found' ? { actual: NODE } : {}),
  };
}

/** A whole-collection issue: path is exactly the collection name. */
function collectionIssue(change: ExpectationFailureReason): SchemaDiffIssue {
  return withPresence(['users'], change);
}

/** An auxiliary (index/validator/options) issue: path is one segment deeper. */
function auxiliaryIssue(change: ExpectationFailureReason): SchemaDiffIssue {
  return withPresence(['users', 'index:email'], change);
}

describe('classifyMongoDiffIssue', () => {
  it('classifies not-expected at collection depth as extra-top-level-object', () => {
    expect(classifyMongoDiffIssue(collectionIssue('not-expected'))).toBe('extraTopLevelObject');
  });

  it('classifies not-expected at auxiliary depth as extra-auxiliary (indexes, validators)', () => {
    expect(classifyMongoDiffIssue(auxiliaryIssue('not-expected'))).toBe('extraAuxiliary');
  });

  it('classifies not-found as declared-missing (collection, validator)', () => {
    expect(classifyMongoDiffIssue(collectionIssue('not-found'))).toBe('declaredMissing');
    expect(classifyMongoDiffIssue(auxiliaryIssue('not-found'))).toBe('declaredMissing');
  });

  it('classifies not-equal as declared-incompatible (index, validator/options mismatch)', () => {
    expect(classifyMongoDiffIssue(auxiliaryIssue('not-equal'))).toBe('declaredIncompatible');
  });
});

describe('verifierDisposition', () => {
  it('fails declared drift and extras under managed', () => {
    expect(verifierDisposition('managed', collectionIssue('not-found'))).toBe('fail');
    expect(verifierDisposition('managed', auxiliaryIssue('not-found'))).toBe('fail');
    expect(verifierDisposition('managed', auxiliaryIssue('not-equal'))).toBe('fail');
    expect(verifierDisposition('managed', auxiliaryIssue('not-expected'))).toBe('fail');
    expect(verifierDisposition('managed', collectionIssue('not-expected'))).toBe('fail');
  });

  it('fails extra auxiliaries under tolerated (no nested element on Mongo)', () => {
    expect(verifierDisposition('tolerated', auxiliaryIssue('not-expected'))).toBe('fail');
    expect(verifierDisposition('tolerated', collectionIssue('not-expected'))).toBe('fail');
    expect(verifierDisposition('tolerated', collectionIssue('not-found'))).toBe('fail');
    expect(verifierDisposition('tolerated', auxiliaryIssue('not-equal'))).toBe('fail');
  });

  it('suppresses extras under external, still fails declared drift', () => {
    expect(verifierDisposition('external', auxiliaryIssue('not-expected'))).toBe('suppress');
    expect(verifierDisposition('external', collectionIssue('not-expected'))).toBe('suppress');
    expect(verifierDisposition('external', collectionIssue('not-found'))).toBe('fail');
    expect(verifierDisposition('external', auxiliaryIssue('not-found'))).toBe('fail');
    expect(verifierDisposition('external', auxiliaryIssue('not-equal'))).toBe('fail');
  });

  it('warns on every emitted reason under observed', () => {
    expect(verifierDisposition('observed', collectionIssue('not-found'))).toBe('warn');
    expect(verifierDisposition('observed', collectionIssue('not-expected'))).toBe('warn');
    expect(verifierDisposition('observed', auxiliaryIssue('not-expected'))).toBe('warn');
    expect(verifierDisposition('observed', auxiliaryIssue('not-found'))).toBe('warn');
    expect(verifierDisposition('observed', auxiliaryIssue('not-equal'))).toBe('warn');
  });
});
