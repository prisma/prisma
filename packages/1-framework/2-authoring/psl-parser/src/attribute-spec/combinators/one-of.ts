import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { ArgType, AttributeCtx, OutOf } from '../types';
import { leafDiagnostic } from './diagnostic';

export function oneOf<
  Ctx extends AttributeCtx,
  Alts extends readonly [ArgType<unknown, Ctx>, ...ArgType<unknown, Ctx>[]],
>(...alts: Alts): ArgType<OutOf<Alts[number]>, Ctx> {
  const label = alts.map((alt) => alt.label).join(' | ');
  return {
    kind: 'oneOf',
    label,
    parse: (arg, ctx): Result<OutOf<Alts[number]>, readonly PslDiagnostic[]> => {
      for (const alt of alts) {
        const result = alt.parse(arg, ctx);
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
