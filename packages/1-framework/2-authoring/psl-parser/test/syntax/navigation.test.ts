import { assertDefined } from '@internal/utils/assertions';
import { describe, expect, it } from 'vitest';
import { GreenNodeBuilder } from '../../src/syntax/green-builder';
import {
  isTrivia,
  isTriviaKind,
  nonTriviaSibling,
  skipTriviaToken,
} from '../../src/syntax/navigation';
import { createSyntaxTree, SyntaxNode, type SyntaxToken } from '../../src/syntax/red';
import type { SyntaxKind } from '../../src/syntax/syntax-kind';

/** Builds a tree for: model User {\n  id Int @id\n} */
function buildSampleTree() {
  const b = new GreenNodeBuilder();
  b.startNode('Document');
  b.startNode('ModelDeclaration');
  b.token('Ident', 'model');
  b.token('Whitespace', ' ');
  b.startNode('Identifier');
  b.token('Ident', 'User');
  b.finishNode();
  b.token('Whitespace', ' ');
  b.token('LBrace', '{');
  b.token('Newline', '\n');
  b.token('Whitespace', '  ');
  b.startNode('FieldDeclaration');
  b.startNode('Identifier');
  b.token('Ident', 'id');
  b.finishNode();
  b.token('Whitespace', ' ');
  b.startNode('TypeAnnotation');
  b.token('Ident', 'Int');
  b.finishNode();
  b.token('Whitespace', ' ');
  b.startNode('FieldAttribute');
  b.token('At', '@');
  b.startNode('Identifier');
  b.token('Ident', 'id');
  b.finishNode();
  b.finishNode();
  b.finishNode();
  b.token('Newline', '\n');
  b.token('RBrace', '}');
  b.finishNode();
  return b.finishNode();
}

function firstNodeOfKind(root: SyntaxNode, kind: SyntaxKind): SyntaxNode {
  for (const el of root.descendants()) {
    if (el instanceof SyntaxNode && el.kind === kind) return el;
  }
  throw new Error(`no ${kind} node in tree`);
}

/**
 * Tokens of {@link buildSampleTree} in document order:
 * 0 `model` 1 ` ` 2 `User` 3 ` ` 4 `{` 5 `\n` 6 `  ` 7 `id` 8 ` ` 9 `Int`
 * 10 ` ` 11 `@` 12 `id` 13 `\n` 14 `}`
 */
function sampleTokens(root: SyntaxNode): SyntaxToken[] {
  return Array.from(root.tokens());
}

describe('isTriviaKind / isTrivia', () => {
  it('classifies whitespace, newline, and comment as trivia', () => {
    expect(isTriviaKind('Whitespace')).toBe(true);
    expect(isTriviaKind('Newline')).toBe(true);
    expect(isTriviaKind('Comment')).toBe(true);
    expect(isTriviaKind('Ident')).toBe(false);
  });

  it('classifies a token instance', () => {
    const tokens = sampleTokens(createSyntaxTree(buildSampleTree()));
    const intToken = tokens[9];
    const spaceToken = tokens[8];
    assertDefined(intToken, 'expected a token at index 9');
    assertDefined(spaceToken, 'expected a token at index 8');
    expect(isTrivia(intToken)).toBe(false); // Int
    expect(isTrivia(spaceToken)).toBe(true); // space before Int
  });
});

describe('skipTriviaToken', () => {
  it('returns the token itself when already significant', () => {
    const intToken = sampleTokens(createSyntaxTree(buildSampleTree()))[9];
    assertDefined(intToken, 'expected a token at index 9');
    expect(skipTriviaToken(intToken, 'next')).toBe(intToken);
    expect(skipTriviaToken(intToken, 'prev')).toBe(intToken);
  });

  it('skips forward to the next significant token', () => {
    const tokens = sampleTokens(createSyntaxTree(buildSampleTree()));
    const space = tokens[1]; // between `model` and `User`
    assertDefined(space, 'expected a token at index 1');
    expect(space.kind).toBe('Whitespace');
    expect(skipTriviaToken(space, 'next')?.text).toBe('User');
  });

  it('skips backward to the previous significant token', () => {
    const tokens = sampleTokens(createSyntaxTree(buildSampleTree()));
    const space = tokens[1];
    assertDefined(space, 'expected a token at index 1');
    expect(skipTriviaToken(space, 'prev')?.text).toBe('model');
  });

  it('returns undefined when only trivia remains', () => {
    const b = new GreenNodeBuilder();
    b.startNode('Document');
    b.token('Whitespace', '   ');
    const root = createSyntaxTree(b.finishNode());
    const trivia = root.firstToken;
    expect(trivia?.kind).toBe('Whitespace');
    if (trivia !== undefined) {
      expect(skipTriviaToken(trivia, 'next')).toBeUndefined();
      expect(skipTriviaToken(trivia, 'prev')).toBeUndefined();
    }
  });
});

describe('nonTriviaSibling', () => {
  it('skips trivia tokens between sibling nodes', () => {
    const root = createSyntaxTree(buildSampleTree());
    const field = firstNodeOfKind(root, 'FieldDeclaration');
    const name = field.firstChild;
    expect(name).toBeInstanceOf(SyntaxNode);
    if (name instanceof SyntaxNode) {
      const next = nonTriviaSibling(name, 'next');
      expect(next).toBeInstanceOf(SyntaxNode);
      if (next instanceof SyntaxNode) {
        expect(next.kind).toBe('TypeAnnotation');
      }
    }
  });

  it('walks backward past trivia', () => {
    const root = createSyntaxTree(buildSampleTree());
    const field = firstNodeOfKind(root, 'FieldDeclaration');
    const attr = firstNodeOfKind(field, 'FieldAttribute');
    const prev = nonTriviaSibling(attr, 'prev');
    expect(prev).toBeInstanceOf(SyntaxNode);
    if (prev instanceof SyntaxNode) {
      expect(prev.kind).toBe('TypeAnnotation');
    }
  });

  it('returns undefined when no significant sibling exists', () => {
    const root = createSyntaxTree(buildSampleTree());
    const typeAnnotation = firstNodeOfKind(root, 'TypeAnnotation');
    const intToken = typeAnnotation.firstChild;
    expect(intToken).not.toBeInstanceOf(SyntaxNode);
    if (intToken !== undefined && !(intToken instanceof SyntaxNode)) {
      expect(nonTriviaSibling(intToken, 'next')).toBeUndefined();
    }
  });
});
