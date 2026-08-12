import type { AstNode } from '../ast-helpers';
import { findChildToken } from '../ast-helpers';
import type { SyntaxNode, SyntaxToken } from '../red';

export class IdentifierAst implements AstNode {
  readonly syntax: SyntaxNode;

  constructor(syntax: SyntaxNode) {
    this.syntax = syntax;
  }

  token(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'Ident');
  }

  name(): string | undefined {
    return this.token()?.text;
  }

  static cast(node: SyntaxNode): IdentifierAst | undefined {
    return node.kind === 'Identifier' ? new IdentifierAst(node) : undefined;
  }
}
