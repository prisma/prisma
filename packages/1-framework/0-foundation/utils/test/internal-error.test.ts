import { describe, expect, it } from 'vitest';
import { assertDefined, invariant } from '../src/assertions';
import { assertNever, InternalError, isInternalError } from '../src/internal-error';
import { structuredError } from '../src/structured-error';

describe('InternalError', () => {
  it('is an Error with name InternalError', () => {
    const error = new InternalError('bug');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InternalError');
    expect(error.message).toBe('bug');
  });

  it('carries cause when passed', () => {
    const cause = new Error('root cause');
    const error = new InternalError('bug', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('isInternalError', () => {
  it('true for an InternalError', () => {
    expect(isInternalError(new InternalError('bug'))).toBe(true);
  });

  it('false for a plain Error', () => {
    expect(isInternalError(new Error('x'))).toBe(false);
  });

  it('false for a structuredError', () => {
    expect(isInternalError(structuredError('CONTRACT.MARKER_MISSING', 'm'))).toBe(false);
  });

  it('false for null', () => {
    expect(isInternalError(null)).toBe(false);
  });
});

describe('assertNever', () => {
  it('throws an InternalError', () => {
    expect(() => assertNever('unexpected' as never)).toThrow(InternalError);
  });

  it('throws with the given message', () => {
    expect(() => assertNever('unexpected' as never, 'custom message')).toThrow('custom message');
  });
});

describe('invariant and assertDefined rebuilt on InternalError', () => {
  it('invariant throws an InternalError', () => {
    expect(() => invariant(false, 'condition failed')).toThrow(InternalError);
    expect(() => invariant(false, 'condition failed')).toThrow('condition failed');
  });

  it('assertDefined throws an InternalError', () => {
    expect(() => assertDefined(null, 'value was null')).toThrow(InternalError);
    expect(() => assertDefined(null, 'value was null')).toThrow('value was null');
  });
});
