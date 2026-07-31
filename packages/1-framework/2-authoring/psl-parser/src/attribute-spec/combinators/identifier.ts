import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { IdentifierAst } from '../../syntax/ast/identifier';
import type { ArgType } from '../types';
import { leafDiagnostic } from './diagnostic';

export function identifier<const N extends string>(name: N): ArgType<N> {
  return {
    kind: 'identifier',
    label: name,
    parse: (arg, ctx): Result<N, readonly PslDiagnostic[]> => {
      if (arg instanceof IdentifierAst && arg.name() === name) return ok(name);
      return notOk([leafDiagnostic(ctx, arg, `Expected ${name}`)]);
    },
  };
}
