import type { AnyExpression as AstExpression, CodecRef } from '@internal/sql-relational-core/ast';
import { PreparedParamRef } from '@internal/sql-relational-core/ast';
import type { Expression, ScopeField } from '@internal/sql-relational-core/expression';
import type { BindSiteParams, Declaration, ParamSpec } from './types';

function normalizeSpec(spec: ParamSpec): { codec: CodecRef; nullable: boolean } {
  if (typeof spec === 'string') return { codec: { codecId: spec }, nullable: false };
  const codec: CodecRef =
    spec.typeParams !== undefined
      ? { codecId: spec.codecId, typeParams: spec.typeParams }
      : { codecId: spec.codecId };
  return { codec, nullable: spec.nullable === true };
}

class BindSiteExpression implements Expression<ScopeField> {
  readonly returnType: ScopeField;
  readonly #ast: AstExpression;
  constructor(ref: PreparedParamRef, returnType: ScopeField) {
    this.#ast = ref;
    this.returnType = returnType;
  }
  buildAst(): AstExpression {
    return this.#ast;
  }
}

export function buildBindSiteParams<D extends Declaration>(declaration: D): BindSiteParams<D> {
  const params: Record<string, Expression<ScopeField>> = {};
  for (const [name, spec] of Object.entries(declaration)) {
    const { codec, nullable } = normalizeSpec(spec);
    const ref = PreparedParamRef.of(name, codec);
    params[name] = new BindSiteExpression(ref, { codecId: codec.codecId, nullable });
  }
  // The cast narrows the structurally-equivalent record to the per-key
  // codecId/nullable types declared by D — TypeScript can't relate the
  // mapped-type keys to the runtime keys without reflection.
  return Object.freeze(params) as BindSiteParams<D>;
}
