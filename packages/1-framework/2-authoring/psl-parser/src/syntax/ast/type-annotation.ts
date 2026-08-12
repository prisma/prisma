import type { AstNode } from '../ast-helpers';
import { findChildToken, findFirstChild } from '../ast-helpers';
import type { SyntaxNode, SyntaxToken } from '../red';
import { AttributeArgListAst } from './attributes';
import { QualifiedNameAst } from './qualified-name';

export class TypeAnnotationAst implements AstNode {
  readonly syntax: SyntaxNode;

  constructor(syntax: SyntaxNode) {
    this.syntax = syntax;
  }

  /** The annotation's reference, doubling as the constructor callee when an {@link argList} follows. */
  name(): QualifiedNameAst | undefined {
    return findFirstChild(this.syntax, QualifiedNameAst.cast);
  }

  /** Present when the annotation is a constructor (`Vector(1536)`) rather than a plain reference. */
  argList(): AttributeArgListAst | undefined {
    return findFirstChild(this.syntax, AttributeArgListAst.cast);
  }

  isConstructor(): boolean {
    return this.argList() !== undefined;
  }

  lbracket(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'LBracket');
  }

  rbracket(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'RBracket');
  }

  questionMark(): SyntaxToken | undefined {
    return findChildToken(this.syntax, 'Question');
  }

  isList(): boolean {
    return this.lbracket() !== undefined;
  }

  isOptional(): boolean {
    return this.questionMark() !== undefined;
  }

  static cast(node: SyntaxNode): TypeAnnotationAst | undefined {
    return node.kind === 'TypeAnnotation' ? new TypeAnnotationAst(node) : undefined;
  }
}
