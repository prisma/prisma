import type { TokenKind } from '../tokenizer';
import { type SyntaxElement, SyntaxToken } from './red';

/** Direction of a sibling/token walk. */
export type Direction = 'next' | 'prev';

const TRIVIA_KINDS: ReadonlySet<TokenKind> = new Set<TokenKind>([
  'Whitespace',
  'Newline',
  'Comment',
]);

/** Whether a token kind is trivia (whitespace, newline, or comment). */
export function isTriviaKind(kind: TokenKind): boolean {
  return TRIVIA_KINDS.has(kind);
}

/** Whether a token is trivia. */
export function isTrivia(token: SyntaxToken): boolean {
  return isTriviaKind(token.kind);
}

/**
 * The first non-trivia token at or beyond `token` in `direction`. Returns
 * `token` itself when it is already significant.
 */
export function skipTriviaToken(token: SyntaxToken, direction: Direction): SyntaxToken | undefined {
  let current: SyntaxToken | undefined = token;
  while (current !== undefined && isTrivia(current)) {
    current = direction === 'next' ? current.nextToken : current.prevToken;
  }
  return current;
}

/**
 * The nearest sibling of `element` (within the same parent) in `direction` that
 * is not a trivia token. Nodes are always significant.
 */
export function nonTriviaSibling(
  element: SyntaxElement,
  direction: Direction,
): SyntaxElement | undefined {
  let sibling = step(element, direction);
  while (sibling !== undefined) {
    if (!(sibling instanceof SyntaxToken) || !isTrivia(sibling)) {
      return sibling;
    }
    sibling = step(sibling, direction);
  }
  return undefined;
}

function step(element: SyntaxElement, direction: Direction): SyntaxElement | undefined {
  return direction === 'next' ? element.nextSiblingOrToken : element.prevSiblingOrToken;
}
