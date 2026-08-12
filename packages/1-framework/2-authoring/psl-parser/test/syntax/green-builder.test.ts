import { isInternalError } from '@internal/utils/internal-error';
import { describe, expect, it } from 'vitest';
import type { GreenElement } from '../../src/syntax/green';
import { GreenNodeBuilder } from '../../src/syntax/green-builder';

function collectTexts(el: GreenElement): string {
  if (el.type === 'token') return el.text;
  return el.children.map(collectTexts).join('');
}

describe('GreenNodeBuilder', () => {
  it('builds a flat node with tokens', () => {
    const b = new GreenNodeBuilder();
    b.startNode('Identifier');
    b.token('Ident', 'User');
    const root = b.finishNode();

    expect(root.kind).toBe('Identifier');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.type).toBe('token');
    expect(root.textLength).toBe(4);
  });

  it('builds nested nodes', () => {
    const b = new GreenNodeBuilder();
    b.startNode('Document');
    b.startNode('ModelDeclaration');
    b.token('Ident', 'model');
    b.token('Whitespace', ' ');
    b.startNode('Identifier');
    b.token('Ident', 'User');
    b.finishNode();
    b.finishNode();
    const root = b.finishNode();

    expect(root.kind).toBe('Document');
    expect(root.children).toHaveLength(1);
    const model = root.children[0];
    expect(model?.type).toBe('node');
    if (model?.type === 'node') {
      expect(model.kind).toBe('ModelDeclaration');
      expect(model.children).toHaveLength(3);
    }
  });

  it('inner finishNode returns the completed node', () => {
    const b = new GreenNodeBuilder();
    b.startNode('Document');
    b.startNode('Identifier');
    b.token('Ident', 'x');
    const inner = b.finishNode();
    expect(inner.kind).toBe('Identifier');
  });

  it('throws on finishNode with no open node', () => {
    const b = new GreenNodeBuilder();
    expect(() => b.finishNode()).toThrow('no open node');
  });

  it('throws on token with no open node', () => {
    const b = new GreenNodeBuilder();
    expect(() => b.token('Ident', 'x')).toThrow('no open node');
  });

  it('reports the no-open-node invariants as InternalError', () => {
    for (const trigger of [
      () => new GreenNodeBuilder().finishNode(),
      () => new GreenNodeBuilder().token('Ident', 'x'),
    ]) {
      let thrown: unknown;
      try {
        trigger();
      } catch (error) {
        thrown = error;
      }
      expect(isInternalError(thrown)).toBe(true);
    }
  });

  it('produces lossless round-trip', () => {
    const source = 'model User {\n  id Int @id\n}';
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
    const root = b.finishNode();

    expect(collectTexts(root)).toBe(source);
  });
});
