import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { ModelSymbol } from '../../symbol-table';
import type { ExpressionAst } from '../../syntax/ast/expressions';
import { IdentifierAst } from '../../syntax/ast/identifier';
import type { ArgType, AttributeCtx, FieldAttributeCtx, ModelAttributeCtx } from '../types';
import { leafDiagnostic } from './diagnostic';

function parseFieldName(
  arg: ExpressionAst,
  ctx: AttributeCtx,
  model: ModelSymbol | undefined,
): Result<string, readonly PslDiagnostic[]> {
  const identifier = IdentifierAst.cast(arg.syntax);
  if (identifier === undefined) {
    return notOk([leafDiagnostic(ctx, arg, 'Expected a field name')]);
  }
  const name = identifier.name();
  if (name === undefined) {
    return notOk([leafDiagnostic(ctx, arg, 'Expected a field name')]);
  }
  // A referenced model in another space can't be resolved here (resolveReferencedModel returns undefined); skip the existence check — it runs where that model is known.
  if (model !== undefined && !Object.hasOwn(model.fields, name)) {
    return notOk([
      leafDiagnostic(ctx, arg, `Field "${name}" does not exist on model "${model.name}"`),
    ]);
  }
  return ok(name);
}

export function fieldRef(): ArgType<string, ModelAttributeCtx> {
  return {
    kind: 'fieldRef',
    label: 'field name',
    parse: (arg, ctx) => parseFieldName(arg, ctx, ctx.selfModel),
  };
}

export function referencedFieldRef(): ArgType<string, FieldAttributeCtx> {
  return {
    kind: 'fieldRef',
    label: 'field name',
    parse: (arg, ctx) => parseFieldName(arg, ctx, ctx.resolveReferencedModel()),
  };
}
