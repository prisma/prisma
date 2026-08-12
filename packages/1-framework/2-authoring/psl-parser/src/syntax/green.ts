import type { TokenKind } from '../tokenizer';
import type { SyntaxKind } from './syntax-kind';

export interface GreenToken {
  readonly type: 'token';
  readonly kind: TokenKind;
  readonly text: string;
}

export interface GreenNode {
  readonly type: 'node';
  readonly kind: SyntaxKind;
  readonly children: ReadonlyArray<GreenElement>;
  readonly textLength: number;
}

export type GreenElement = GreenNode | GreenToken;

export function greenToken(kind: TokenKind, text: string): GreenToken {
  return { type: 'token', kind, text };
}

export function greenNode(kind: SyntaxKind, children: ReadonlyArray<GreenElement>): GreenNode {
  let textLength = 0;
  for (const child of children) {
    textLength += child.type === 'token' ? child.text.length : child.textLength;
  }
  return { type: 'node', kind, children, textLength };
}
