import { describe, expect, it } from 'vitest';
import {
  createPreserveEmptyPredicate,
  matchesPathPattern,
  type PathPattern,
} from '../src/canonicalization-path-match';

describe('matchesPathPattern', () => {
  it('matches a literal path exactly', () => {
    const pattern = ['storage', 'namespaces'] as const satisfies PathPattern;
    expect(matchesPathPattern(['storage', 'namespaces'], pattern)).toBe(true);
    expect(matchesPathPattern(['storage', 'types'], pattern)).toBe(false);
  });

  it('matches a wildcard segment at any value', () => {
    const pattern = [
      'storage',
      'namespaces',
      '*',
      'entries',
      'table',
    ] as const satisfies PathPattern;
    expect(
      matchesPathPattern(['storage', 'namespaces', '__unbound__', 'entries', 'table'], pattern),
    ).toBe(true);
    expect(
      matchesPathPattern(['storage', 'namespaces', 'public', 'entries', 'table'], pattern),
    ).toBe(true);
    expect(
      matchesPathPattern(['storage', 'namespaces', 'public', 'entries', 'collection'], pattern),
    ).toBe(false);
  });

  it('rejects paths shorter or longer than the pattern', () => {
    const pattern = [
      'storage',
      'namespaces',
      '*',
      'entries',
      'table',
    ] as const satisfies PathPattern;
    expect(matchesPathPattern(['storage', 'namespaces'], pattern)).toBe(false);
    expect(
      matchesPathPattern(['storage', 'namespaces', 'a', 'entries', 'table', 'extra'], pattern),
    ).toBe(false);
  });

  it('matches an alternative segment list at one position', () => {
    const pattern = [
      'storage',
      'namespaces',
      '*',
      'entries',
      'table',
      '*',
      ['uniques', 'indexes', 'foreignKeys'],
    ] as const satisfies PathPattern;
    expect(
      matchesPathPattern(
        ['storage', 'namespaces', 'ns', 'entries', 'table', 'users', 'indexes'],
        pattern,
      ),
    ).toBe(true);
    expect(
      matchesPathPattern(
        ['storage', 'namespaces', 'ns', 'entries', 'table', 'users', 'columns'],
        pattern,
      ),
    ).toBe(false);
  });
});

describe('createPreserveEmptyPredicate', () => {
  const sqlPatterns = [
    ['storage', 'namespaces', '*', 'entries', 'table'],
    ['storage', 'namespaces', '*', 'entries', 'table', '*'],
    ['storage', 'namespaces', '*', 'entries', 'table', '*', ['uniques', 'indexes', 'foreignKeys']],
    ['storage', 'namespaces', '*', 'entries', 'table', '*', 'foreignKeys', ['constraint', 'index']],
  ] as const satisfies readonly PathPattern[];

  const shouldPreserveEmpty = createPreserveEmptyPredicate(sqlPatterns);

  it('preserves namespace entries.table containers and table entries', () => {
    expect(shouldPreserveEmpty(['storage', 'namespaces', '__unbound__', 'entries', 'table'])).toBe(
      true,
    );
    expect(
      shouldPreserveEmpty(['storage', 'namespaces', '__unbound__', 'entries', 'table', 'users']),
    ).toBe(true);
  });

  it('preserves table uniques, indexes, and foreignKeys', () => {
    expect(
      shouldPreserveEmpty(['storage', 'namespaces', 'ns', 'entries', 'table', 'users', 'uniques']),
    ).toBe(true);
    expect(
      shouldPreserveEmpty(['storage', 'namespaces', 'ns', 'entries', 'table', 'users', 'indexes']),
    ).toBe(true);
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'ns',
        'entries',
        'table',
        'users',
        'foreignKeys',
      ]),
    ).toBe(true);
  });

  it('preserves FK boolean fields in array-form foreignKeys', () => {
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'ns',
        'entries',
        'table',
        'posts',
        'foreignKeys',
        'constraint',
      ]),
    ).toBe(true);
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'ns',
        'entries',
        'table',
        'posts',
        'foreignKeys',
        'index',
      ]),
    ).toBe(true);
  });

  it('does not preserve storage.types typeParams (no entry in patterns)', () => {
    expect(shouldPreserveEmpty(['storage', 'types', 'MyType', 'typeParams'])).toBe(false);
  });

  it('returns false for unrelated paths', () => {
    expect(shouldPreserveEmpty(['models'])).toBe(false);
    expect(shouldPreserveEmpty(['storage', 'namespaces', 'ns', 'entries', 'collection'])).toBe(
      false,
    );
  });
});
