import type { CodecRef } from '@internal/framework-components/codec';
import type { AnyExpression as AstExpression } from '@internal/sql-relational-core/ast';
import type { Expression } from '@internal/sql-relational-core/expression';
import type { ScopeField } from '../scope';

/**
 * Runtime wrapper around a relational-core AST expression node. Carries ScopeField metadata (codecId, nullable) so aggregate-like combinators can propagate the input codec onto their result.
 *
 * `codec` records the column-bound {@link CodecRef} when the field-proxy knows the binding — both the namespaced form (`f.user.email` → `ColumnRef`) and the top-level shortcut (`f.email` → `IdentifierRef`) stamp the ref derived from contract storage. `codecOf(expression)` exposes it for operation implementations forwarding the ref to `toExpr`.
 */
export class ExpressionImpl<T extends ScopeField = ScopeField> implements Expression<T> {
  private readonly ast: AstExpression;
  readonly returnType: T;
  readonly codec: CodecRef | undefined;

  constructor(ast: AstExpression, returnType: T, codec?: CodecRef) {
    this.ast = ast;
    this.returnType = returnType;
    this.codec = codec;
  }

  buildAst(): AstExpression {
    return this.ast;
  }
}
