import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { BooleanLiteralExprAst } from '../../syntax/ast/expressions';
import type { AttributeCtx, BoolArgType } from '../types';
import { leafDiagnostic } from './diagnostic';

export function bool(): BoolArgType<AttributeCtx> {
  return {
    kind: 'bool',
    label: 'boolean',
    requiredContext: 'attribute',
    parse: (arg, ctx): Result<boolean, readonly PslDiagnostic[]> => {
      const literal = BooleanLiteralExprAst.cast(arg.syntax);
      if (literal !== undefined) {
        const value = literal.value();
        if (value !== undefined) return ok(value);
      }
      return notOk([leafDiagnostic(ctx, arg, 'Expected a boolean literal')]);
    },
  };
}
