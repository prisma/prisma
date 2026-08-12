import type { AstNode } from '../ast-helpers';
import { filterChildren, findChildToken, findFirstChild } from '../ast-helpers';
import type { SyntaxNode, SyntaxToken } from '../red';
import { AttributeArgAst } from './expressions';
import { QualifiedNameAst } from './qualified-name';

export class AttributeArgListAst implements AstNode {
  readonly syntax: SyntaxNode;

  constructor(syntax: SyntaxNode) {
    this.syntax = syntax;
  }

  lparen(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'LParen');
  }

  rparen(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'RParen');
  }

  *args(): Iterable<AttributeArgAst> {
    yield* filterChildren(this.syntax, AttributeArgAst.cast);
  }

  static cast(node: SyntaxNode): AttributeArgListAst | undefined {
    return node.kind === 'AttributeArgList' ? new AttributeArgListAst(node) : undefined;
  }
}

export class FieldAttributeAst implements AstNode {
  readonly syntax: SyntaxNode;

  constructor(syntax: SyntaxNode) {
    this.syntax = syntax;
  }

  at(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'At');
  }

  name(): QualifiedNameAst | undefined {
    return findFirstChild(this.syntax, QualifiedNameAst.cast);
  }

  argList(): AttributeArgListAst | undefined {
    return findFirstChild(this.syntax, AttributeArgListAst.cast);
  }

  static cast(node: SyntaxNode): FieldAttributeAst | undefined {
    return node.kind === 'FieldAttribute' ? new FieldAttributeAst(node) : undefined;
  }
}

export class ModelAttributeAst implements AstNode {
  readonly syntax: SyntaxNode;

  constructor(syntax: SyntaxNode) {
    this.syntax = syntax;
  }

  doubleAt(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'DoubleAt');
  }

  name(): QualifiedNameAst | undefined {
    return findFirstChild(this.syntax, QualifiedNameAst.cast);
  }

  argList(): AttributeArgListAst | undefined {
    return findFirstChild(this.syntax, AttributeArgListAst.cast);
  }

  static cast(node: SyntaxNode): ModelAttributeAst | undefined {
    return node.kind === 'ModelAttribute' ? new ModelAttributeAst(node) : undefined;
  }
}
