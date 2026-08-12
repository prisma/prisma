import { describe, expect, it } from 'vitest';
import type { VerifierIssueCategory } from '../src/control/verifier-disposition';
import { dispositionForCategory } from '../src/control/verifier-disposition';

const ALL_CATEGORIES: VerifierIssueCategory[] = [
  'declaredMissing',
  'declaredIncompatible',
  'valueDrift',
  'extraNestedElement',
  'extraAuxiliary',
  'extraTopLevelObject',
];

describe('dispositionForCategory', () => {
  it('fails every category under managed', () => {
    for (const category of ALL_CATEGORIES) {
      expect(dispositionForCategory('managed', category)).toBe('fail');
    }
  });

  it('suppresses only the extra nested element under tolerated', () => {
    expect(dispositionForCategory('tolerated', 'extraNestedElement')).toBe('suppress');
    expect(dispositionForCategory('tolerated', 'extraAuxiliary')).toBe('fail');
    expect(dispositionForCategory('tolerated', 'extraTopLevelObject')).toBe('fail');
    expect(dispositionForCategory('tolerated', 'declaredMissing')).toBe('fail');
    expect(dispositionForCategory('tolerated', 'declaredIncompatible')).toBe('fail');
    expect(dispositionForCategory('tolerated', 'valueDrift')).toBe('fail');
  });

  it('suppresses every extra category and value drift under external', () => {
    expect(dispositionForCategory('external', 'extraNestedElement')).toBe('suppress');
    expect(dispositionForCategory('external', 'extraAuxiliary')).toBe('suppress');
    expect(dispositionForCategory('external', 'extraTopLevelObject')).toBe('suppress');
    expect(dispositionForCategory('external', 'valueDrift')).toBe('suppress');
    expect(dispositionForCategory('external', 'declaredMissing')).toBe('fail');
    expect(dispositionForCategory('external', 'declaredIncompatible')).toBe('fail');
  });

  it('warns on every category under observed', () => {
    for (const category of ALL_CATEGORIES) {
      expect(dispositionForCategory('observed', category)).toBe('warn');
    }
  });
});
