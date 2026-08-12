import { describe, expect, it } from 'vitest';
import { ifDefined } from '../src/defined';

describe('ifDefined', () => {
  it('returns object with key/value when value is defined', () => {
    const result = ifDefined('name', 'Alice');
    expect(result).toEqual({ name: 'Alice' });
  });

  it('returns empty object when value is undefined', () => {
    const result = ifDefined('name', undefined);
    expect(result).toEqual({});
  });

  it('preserves falsy values that are not undefined', () => {
    expect(ifDefined('value', 0)).toEqual({ value: 0 });
    expect(ifDefined('value', '')).toEqual({ value: '' });
    expect(ifDefined('value', false)).toEqual({ value: false });
    expect(ifDefined('value', null)).toEqual({ value: null });
  });

  it('works with spread operator', () => {
    const optional: string | undefined = 'test';
    const result = {
      required: 'value',
      ...ifDefined('optional', optional),
    };
    expect(result).toEqual({ required: 'value', optional: 'test' });
  });

  it('does not add key when spread with undefined', () => {
    const optional: string | undefined = undefined;
    const result = {
      required: 'value',
      ...ifDefined('optional', optional),
    };
    expect(result).toEqual({ required: 'value' });
    expect('optional' in result).toBe(false);
  });

  it('works with complex objects', () => {
    const context = { path: '/test', config: { debug: true } };
    const result = ifDefined('context', context);
    expect(result).toEqual({ context: { path: '/test', config: { debug: true } } });
  });
});
