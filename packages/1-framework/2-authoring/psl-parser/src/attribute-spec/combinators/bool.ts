import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { BooleanLiteralExprAst } from '../../syntax/ast/expressions';
import type { ArgType } from '../types';
import { leafDiagnostic } from './diagnostic';

export function bool(): ArgType<boolean> {
  return {
    kind: 'bool',
    label: 'boolean',
    parse: (arg, ctx): Result<boolean, readonly PslDiagnostic[]> => {
      if (arg instanceof BooleanLiteralExprAst) {
        const value = arg.value();
        if (value !== undefined) return ok(value);
      }
      return notOk([leafDiagnostic(ctx, arg, 'Expected a boolean literal')]);
    },
  };
}
