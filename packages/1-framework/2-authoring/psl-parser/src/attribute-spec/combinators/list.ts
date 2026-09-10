import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import { ArrayLiteralAst, type ExpressionAst } from '../../syntax/ast/expressions';
import type { ArgType, AttributeCtx, ListArgType, RequiredContextFor } from '../types';
import { leafDiagnostic } from './diagnostic';

export interface ListOptions {
  readonly nonEmpty?: boolean;
  readonly unique?: boolean;
}

export function list<T, Ctx extends AttributeCtx>(
  of: ArgType<T, Ctx>,
): ListArgType<T, Ctx, undefined, undefined>;
export function list<T, Ctx extends AttributeCtx>(
  of: ArgType<T, Ctx>,
  opts: { readonly nonEmpty: true; readonly unique: true },
): ListArgType<T, Ctx, true, true>;
export function list<T, Ctx extends AttributeCtx>(
  of: ArgType<T, Ctx>,
  opts: { readonly nonEmpty: true; readonly unique?: boolean },
): ListArgType<T, Ctx, true, undefined>;
export function list<T, Ctx extends AttributeCtx>(
  of: ArgType<T, Ctx>,
  opts: { readonly nonEmpty?: boolean; readonly unique: true },
): ListArgType<T, Ctx, undefined, true>;
export function list<T, Ctx extends AttributeCtx>(
  of: ArgType<T, Ctx>,
  opts?: ListOptions,
): ListArgType<T, Ctx, true | undefined, true | undefined> {
  const nonEmpty = opts?.nonEmpty === true ? true : undefined;
  const unique = opts?.unique === true ? true : undefined;
  return {
    kind: 'list',
    label: `${of.label}[]`,
    requiredContext: blindCast<
      RequiredContextFor<Ctx>,
      'A list requires exactly the same context as its element parser.'
    >(of.requiredContext),
    of,
    nonEmpty,
    unique,
    parse: (arg, ctx): Result<T[], readonly PslDiagnostic[]> => {
      const literal = ArrayLiteralAst.cast(arg.syntax);
      if (literal === undefined) {
        return notOk([leafDiagnostic(ctx, arg, `Expected a list of ${of.label}`)]);
      }
      const diagnostics: PslDiagnostic[] = [];
      const parsed: { node: ExpressionAst; value: T }[] = [];
      let count = 0;
      for (const element of literal.elements()) {
        count += 1;
        const result = of.parse(element, ctx);
        if (result.ok) parsed.push({ node: element, value: result.value });
        else diagnostics.push(...result.failure);
      }
      if (opts?.nonEmpty === true && count === 0) {
        diagnostics.push(leafDiagnostic(ctx, arg, 'Expected a non-empty list'));
      }
      if (opts?.unique === true) {
        const seen = new Set<T>();
        for (const { node, value } of parsed) {
          if (seen.has(value)) diagnostics.push(leafDiagnostic(ctx, node, 'Duplicate list entry'));
          else seen.add(value);
        }
      }
      if (diagnostics.length > 0) return notOk(diagnostics);
      return ok(parsed.map((entry) => entry.value));
    },
  };
}
