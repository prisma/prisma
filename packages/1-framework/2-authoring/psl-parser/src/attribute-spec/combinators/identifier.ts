import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { IdentifierAst } from '../../syntax/ast/identifier';
import type { ArgType, AttributeCtx } from '../types';
import { leafDiagnostic } from './diagnostic';

export function identifier<const N extends string>(name: N): ArgType<N, AttributeCtx> {
  return {
    kind: 'identifier',
    label: name,
    parse: (arg, ctx): Result<N, readonly PslDiagnostic[]> => {
      const identifier = IdentifierAst.cast(arg.syntax);
      if (identifier !== undefined && identifier.name() === name) return ok(name);
      return notOk([leafDiagnostic(ctx, arg, `Expected ${name}`)]);
    },
  };
}
