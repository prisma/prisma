import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { NumberLiteralExprAst } from '../../syntax/ast/expressions';
import type { ArgType } from '../types';
import { leafDiagnostic } from './diagnostic';

// A general number literal — any number, including floats — reduced to its numeric value.
// Passing `value` pins the combinator to that single literal (`num(4)` matches only `4`),
// mirroring how `identifier(name)` pins a bare identifier. Use `int()` when only integer
// literals are allowed.
export function num(): ArgType<number>;
export function num(value: number): ArgType<number>;
export function num(value?: number): ArgType<number> {
  return {
    kind: 'num',
    label: value === undefined ? 'number' : String(value),
    parse: (arg, ctx): Result<number, readonly PslDiagnostic[]> => {
      if (arg instanceof NumberLiteralExprAst) {
        const parsed = arg.value();
        if (parsed !== undefined && (value === undefined || parsed === value)) return ok(parsed);
      }
      const message = value === undefined ? 'Expected a number literal' : `Expected ${value}`;
      return notOk([leafDiagnostic(ctx, arg, message)]);
    },
  };
}
