import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { AnyArgType, CtxOf, OneOfArgType, OutOf } from '../types';
import { leafDiagnostic } from './diagnostic';

export function oneOf<Alts extends readonly [AnyArgType, ...AnyArgType[]]>(
  ...alts: Alts
): OneOfArgType<Alts, CtxOf<Alts[number]>> {
  const label = alts.map((alt) => alt.label).join(' | ');
  return {
    kind: 'oneOf',
    label,
    requiredContext: alts[0].requiredContext,
    alternatives: alts,
    parse: (arg, ctx): Result<OutOf<Alts[number]>, readonly PslDiagnostic[]> => {
      for (const alt of alts) {
        const result = alt.parse(
          arg,
          blindCast<
            never,
            'Each alternative declares the same runtime context requirement through requiredContext; the parser only invokes oneOf in a context that satisfies the containing attribute level.'
          >(ctx),
        );
        if (result.ok) {
          return ok(
            blindCast<
              OutOf<Alts[number]>,
              'The matched value comes from an alternative whose output type is a member of the union, but iterating the tuple widens each element to ArgType<unknown>, erasing that relationship.'
            >(result.value),
          );
        }
      }
      return notOk([leafDiagnostic(ctx, arg, `Expected one of: ${label}`)]);
    },
  };
}
