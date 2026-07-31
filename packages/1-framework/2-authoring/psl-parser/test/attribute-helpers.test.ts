import type { PslAttribute, PslAttributeArgument } from '@internal/framework-components/psl-ast';
import { describe, expect, it } from 'vitest';
import { getPositionalArgument, parseQuotedStringLiteral } from '../src/attribute-helpers';

const span = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } };

function makeAttribute(args: readonly PslAttributeArgument[]): PslAttribute {
  return { kind: 'attribute', target: 'field', name: 'test', args, span };
}

function positional(value: string): PslAttributeArgument {
  return { kind: 'positional', value, span };
}

function named(name: string, value: string): PslAttributeArgument {
  return { kind: 'named', name, value, span };
}

describe('getPositionalArgument', () => {
  it('returns first positional argument by default', () => {
    const attr = makeAttribute([positional('hello')]);
    expect(getPositionalArgument(attr)).toBe('hello');
  });

  it('returns positional argument at given index', () => {
    const attr = makeAttribute([positional('first'), positional('second')]);
    expect(getPositionalArgument(attr, 1)).toBe('second');
  });

  it('returns undefined when no positional arguments exist', () => {
    const attr = makeAttribute([named('key', 'val')]);
    expect(getPositionalArgument(attr)).toBeUndefined();
  });

  it('returns undefined when index is out of range', () => {
    const attr = makeAttribute([positional('only')]);
    expect(getPositionalArgument(attr, 5)).toBeUndefined();
  });

  it('skips named arguments when counting positional ones', () => {
    const attr = makeAttribute([named('x', 'skip'), positional('target')]);
    expect(getPositionalArgument(attr, 0)).toBe('target');
  });
});

describe('parseQuotedStringLiteral', () => {
  it('parses double-quoted string', () => {
    expect(parseQuotedStringLiteral('"hello"')).toBe('hello');
  });

  it('parses single-quoted string', () => {
    expect(parseQuotedStringLiteral("'world'")).toBe('world');
  });

  it('returns undefined for unquoted value', () => {
    expect(parseQuotedStringLiteral('hello')).toBeUndefined();
  });

  it('returns undefined for mismatched quotes', () => {
    expect(parseQuotedStringLiteral('"hello\'')).toBeUndefined();
  });

  it('handles empty quoted string', () => {
    expect(parseQuotedStringLiteral('""')).toBe('');
  });

  it('trims whitespace before parsing', () => {
    expect(parseQuotedStringLiteral('  "trimmed"  ')).toBe('trimmed');
  });
});
