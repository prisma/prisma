import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { UnionToIntersection } from '@internal/utils/types';
import type { ArgType, AttributeCtx, CtxOf, OutOf } from '../types';
import { leafDiagnostic } from './diagnostic';

export type OneOfCtx<Alts extends readonly ArgType<unknown, never>[]> = UnionToIntersection<
  CtxOf<Alts[number]>
> &
  AttributeCtx;

export function oneOf<
  const Alts extends readonly [ArgType<unknown, never>, ...ArgType<unknown, never>[]],
>(...alts: [...Alts]): ArgType<OutOf<Alts[number]>, OneOfCtx<Alts>> {
  const label = alts.map((alt) => alt.label).join(' | ');
  return {
    kind: 'oneOf',
    label,
    parse: (arg, ctx): Result<OutOf<Alts[number]>, readonly PslDiagnostic[]> => {
      for (const alt of alts) {
        const result = alt.parse(
          arg,
          blindCast<
            never,
            'Each alternative declares the ctx it reads and oneOf demands their intersection, so the received ctx satisfies every alternative; iterating the tuple widens each element to its `never`-ctx bound and erases that.'
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
