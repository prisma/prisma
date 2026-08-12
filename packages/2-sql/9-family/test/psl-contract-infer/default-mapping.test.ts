import { describe, expect, it } from 'vitest';
import {
  type DefaultMappingOptions,
  mapDefault,
} from '../../src/core/psl-contract-infer/default-mapping';

// Inline dialect-mapping fixture (the Postgres maps now live in the target);
// these cases exercise the neutral `mapDefault` with an injected mapping.
const injectedMapping: DefaultMappingOptions = {
  functionAttributes: { 'gen_random_uuid()': '@default(dbgenerated("gen_random_uuid()"))' },
  fallbackFunctionAttribute: (expression) => `@default(dbgenerated(${JSON.stringify(expression)}))`,
};

describe('mapDefault', () => {
  it('maps autoincrement()', () => {
    expect(mapDefault({ kind: 'function', expression: 'autoincrement()' })).toEqual({
      attribute: '@default(autoincrement())',
    });
  });

  it('maps now()', () => {
    expect(mapDefault({ kind: 'function', expression: 'now()' })).toEqual({
      attribute: '@default(now())',
    });
  });

  it('maps gen_random_uuid() when Postgres mapping is injected', () => {
    expect(
      mapDefault({ kind: 'function', expression: 'gen_random_uuid()' }, injectedMapping),
    ).toEqual({
      attribute: '@default(dbgenerated("gen_random_uuid()"))',
    });
  });

  it('maps unmapped Postgres defaults to dbgenerated when Postgres mapping is injected', () => {
    expect(mapDefault({ kind: 'function', expression: "'{}'::jsonb" }, injectedMapping)).toEqual({
      attribute: `@default(dbgenerated(${JSON.stringify("'{}'::jsonb")}))`,
    });
  });

  it('maps boolean true', () => {
    expect(mapDefault({ kind: 'literal', value: true })).toEqual({
      attribute: '@default(true)',
    });
  });

  it('maps boolean false', () => {
    expect(mapDefault({ kind: 'literal', value: false })).toEqual({
      attribute: '@default(false)',
    });
  });

  it('maps number', () => {
    expect(mapDefault({ kind: 'literal', value: 42 })).toEqual({
      attribute: '@default(42)',
    });
  });

  it('maps string', () => {
    expect(mapDefault({ kind: 'literal', value: 'hello' })).toEqual({
      attribute: '@default("hello")',
    });
  });

  it('maps string with quotes', () => {
    expect(mapDefault({ kind: 'literal', value: 'he said "hi"' })).toEqual({
      attribute: '@default("he said \\"hi\\"")',
    });
  });

  it('escapes control characters in string defaults', () => {
    expect(mapDefault({ kind: 'literal', value: 'line 1\nline 2\t"quoted"' })).toEqual({
      attribute: '@default("line 1\\nline 2\\t\\"quoted\\"")',
    });
  });

  it('unrecognized function becomes comment', () => {
    expect(mapDefault({ kind: 'function', expression: 'custom_func()' })).toEqual({
      comment: '// Raw default: custom_func()',
    });
  });

  it('treats Postgres-specific functions as raw defaults without injected mapping', () => {
    expect(mapDefault({ kind: 'function', expression: 'gen_random_uuid()' })).toEqual({
      comment: '// Raw default: gen_random_uuid()',
    });
  });

  it('maps null literal', () => {
    expect(mapDefault({ kind: 'literal', value: null })).toEqual({
      attribute: '@default(null)',
    });
  });

  it('maps large number literal', () => {
    expect(mapDefault({ kind: 'literal', value: 9007199254740991 })).toEqual({
      attribute: '@default(9007199254740991)',
    });
  });

  it('stringifies unsupported literal defaults', () => {
    expect(mapDefault({ kind: 'literal', value: { nested: ['value'] } })).toEqual({
      attribute: '@default("{\\"nested\\":[\\"value\\"]}")',
    });
  });
});
