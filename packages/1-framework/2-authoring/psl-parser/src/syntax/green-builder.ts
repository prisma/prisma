import { InternalError } from '@internal/utils/internal-error';
import type { TokenKind } from '../tokenizer';
import type { GreenElement, GreenNode } from './green';
import { greenNode, greenToken } from './green';
import type { SyntaxKind } from './syntax-kind';

export class GreenNodeBuilder {
  readonly #stack: Array<{ kind: SyntaxKind; children: GreenElement[] }> = [];

  startNode(kind: SyntaxKind): void {
    this.#stack.push({ kind, children: [] });
  }

  token(kind: TokenKind, text: string): void {
    const current = this.#stack.at(-1);
    if (!current) {
      throw new InternalError('GreenNodeBuilder: token() called with no open node');
    }
    current.children.push(greenToken(kind, text));
  }

  finishNode(): GreenNode {
    const completed = this.#stack.pop();
    if (!completed) {
      throw new InternalError('GreenNodeBuilder: finishNode() called with no open node');
    }
    const node = greenNode(completed.kind, completed.children);
    const parent = this.#stack.at(-1);
    if (parent) {
      parent.children.push(node);
    }
    return node;
  }
}
