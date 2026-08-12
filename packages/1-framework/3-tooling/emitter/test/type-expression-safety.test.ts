import { describe, expect, it } from 'vitest';
import { isSafeTypeExpression } from '../src/type-expression-safety';

describe('isSafeTypeExpression', () => {
  it('accepts normal type expressions', () => {
    expect(isSafeTypeExpression('Char<36>')).toBe(true);
    expect(isSafeTypeExpression('Vector<1536>')).toBe(true);
    expect(isSafeTypeExpression("'USER' | 'ADMIN'")).toBe(true);
    expect(isSafeTypeExpression('{ name: string; age: number }')).toBe(true);
    expect(isSafeTypeExpression('Numeric<10, 2>')).toBe(true);
    expect(isSafeTypeExpression('Timestamp<3>')).toBe(true);
  });

  it('rejects import expressions', () => {
    expect(isSafeTypeExpression('import("fs")')).toBe(false);
    expect(isSafeTypeExpression('import ("fs")')).toBe(false);
  });

  it('rejects require expressions', () => {
    expect(isSafeTypeExpression('require("fs")')).toBe(false);
  });

  it('rejects declare statements', () => {
    expect(isSafeTypeExpression('declare module "foo"')).toBe(false);
  });

  it('rejects export statements', () => {
    expect(isSafeTypeExpression('export default 42')).toBe(false);
  });

  it('rejects eval expressions', () => {
    expect(isSafeTypeExpression('eval("code")')).toBe(false);
  });
});
