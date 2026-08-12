import { describe, expect, it } from 'vitest';
import type { GreenElement } from '../../src/syntax/green';
import { greenNode, greenToken } from '../../src/syntax/green';

describe('GreenToken', () => {
  it('stores kind and text', () => {
    const t = greenToken('Ident', 'model');
    expect(t.type).toBe('token');
    expect(t.kind).toBe('Ident');
    expect(t.text).toBe('model');
  });
});

describe('GreenNode', () => {
  it('computes textLength from single token child', () => {
    const node = greenNode('Identifier', [greenToken('Ident', 'User')]);
    expect(node.textLength).toBe(4);
  });

  it('computes textLength from multiple token children', () => {
    const node = greenNode('TypeAnnotation', [
      greenToken('Ident', 'Int'),
      greenToken('LBracket', '['),
      greenToken('RBracket', ']'),
    ]);
    expect(node.textLength).toBe(5);
  });

  it('computes textLength from nested nodes', () => {
    const inner = greenNode('Identifier', [greenToken('Ident', 'User')]);
    const outer = greenNode('FieldDeclaration', [
      inner,
      greenToken('Whitespace', ' '),
      greenNode('TypeAnnotation', [greenToken('Ident', 'String')]),
    ]);
    expect(outer.textLength).toBe(11); // "User" + " " + "String"
  });

  it('has textLength 0 for empty node', () => {
    const node = greenNode('Document', []);
    expect(node.textLength).toBe(0);
  });

  it('collects all tokens in document order', () => {
    const tree = greenNode('Document', [
      greenToken('Ident', 'model'),
      greenToken('Whitespace', ' '),
      greenNode('Identifier', [greenToken('Ident', 'User')]),
      greenToken('Whitespace', ' '),
      greenToken('LBrace', '{'),
      greenToken('RBrace', '}'),
    ]);

    const texts: string[] = [];
    function collect(el: GreenElement): void {
      if (el.type === 'token') {
        texts.push(el.text);
      } else {
        for (const child of el.children) {
          collect(child);
        }
      }
    }
    collect(tree);

    expect(texts.join('')).toBe('model User {}');
  });
});
