import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { describe, expect, it } from 'vitest';
import type { ArgType, InterpretCtx } from '../src/exports';
import {
  fieldAttribute,
  int,
  interpretArgs,
  interpretAttribute,
  nodePslSpan,
  optional,
} from '../src/exports';
import { Cursor, parse, parseAttribute } from '../src/parse';
import type { SourceFile } from '../src/source-file';
import { buildSymbolTable } from '../src/symbol-table';
import { FieldAttributeAst } from '../src/syntax/ast/attributes';
import { StringLiteralExprAst } from '../src/syntax/ast/expressions';
import { createSyntaxTree } from '../src/syntax/red';

function makeCtx(sourceFile: SourceFile): InterpretCtx {
  const { document, sourceFile: modelSource } = parse('model M {\n  id Int @id\n}\n');
  const { table } = buildSymbolTable({
    document,
    sourceFile: modelSource,
    pslBlockDescriptors: {},
  });
  const selfModel = table.topLevel.models['M'];
  if (!selfModel) throw new Error('expected model M in the symbol table');
  return {
    level: 'field',
    sourceId: 'schema.prisma',
    sourceFile,
    selfModel,
    resolveReferencedModel: () => undefined,
  };
}

function fieldAttr(source: string): { node: FieldAttributeAst; ctx: InterpretCtx } {
  const cursor = new Cursor(source);
  const node = FieldAttributeAst.cast(createSyntaxTree(parseAttribute(cursor)));
  if (!node) throw new Error('expected a field attribute');
  return { node, ctx: makeCtx(cursor.sourceFile) };
}

function str(): ArgType<string> {
  return {
    kind: 'str',
    label: 'string',
    parse: (arg, ctx): Result<string, readonly PslDiagnostic[]> => {
      if (arg instanceof StringLiteralExprAst) {
        const value = arg.value();
        if (value !== undefined) return ok(value);
      }
      return notOk([
        {
          code: 'PSL_INVALID_ATTRIBUTE_SYNTAX',
          message: 'expected a quoted string',
          sourceId: ctx.sourceId,
          span: nodePslSpan(arg.syntax, ctx.sourceFile),
        },
      ]);
    },
  };
}

const FAILING_DIAGNOSTIC: PslDiagnostic = {
  code: 'PSL_INVALID_ATTRIBUTE_SYNTAX',
  message: 'this leaf always fails',
  sourceId: 'schema.prisma',
  span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } },
};

function failing(): ArgType<never> {
  return {
    kind: 'failing',
    label: 'failing',
    parse: (): Result<never, readonly PslDiagnostic[]> => notOk([FAILING_DIAGNOSTIC]),
  };
}

describe('interpretAttribute positional binding', () => {
  it('binds a positional argument into its slot key', () => {
    const { node, ctx } = fieldAttr('@rel("Posts")');
    const spec = fieldAttribute('rel', { positional: [{ key: 'name', type: str() }] });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ name: 'Posts' });
  });

  it('rejects more positional arguments than declared slots', () => {
    const { node, ctx } = fieldAttr('@rel("a", "b")');
    const spec = fieldAttribute('rel', {
      positional: [{ key: 'name', type: optional(str()) }],
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
      expect(result.failure[0]?.span).toEqual(nodePslSpan(node.syntax, ctx.sourceFile));
    }
  });
});

describe('interpretAttribute named binding', () => {
  it('binds named arguments by key', () => {
    const { node, ctx } = fieldAttr('@rel(name: "Posts", map: "fk")');
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()), map: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ name: 'Posts', map: 'fk' });
  });

  it('rejects an unknown named argument anchored to the argument span', () => {
    const { node, ctx } = fieldAttr('@rel(foo: "x")');
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
      expect(result.failure[0]?.message).toContain('foo');
      expect(result.failure[0]?.span).not.toEqual(nodePslSpan(node.syntax, ctx.sourceFile));
    }
  });
});

describe('interpretAttribute positional-or-named duplicate', () => {
  it('rejects a key supplied both positionally and by name even when the values agree, anchored to the duplicate', () => {
    const { node, ctx } = fieldAttr('@rel("Foo", name: "Foo")');
    const spec = fieldAttribute('rel', {
      positional: [{ key: 'name', type: optional(str()) }],
      named: { name: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
      expect(result.failure[0]?.span).not.toEqual(nodePslSpan(node.syntax, ctx.sourceFile));
    }
  });

  it('rejects a key supplied both positionally and by name when the values disagree, anchored to the duplicate', () => {
    const { node, ctx } = fieldAttr('@rel("A", name: "B")');
    const spec = fieldAttribute('rel', {
      positional: [{ key: 'name', type: optional(str()) }],
      named: { name: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
      expect(result.failure[0]?.span).not.toEqual(nodePslSpan(node.syntax, ctx.sourceFile));
    }
  });
});

describe('interpretAttribute duplicate named arguments', () => {
  it('rejects a named key supplied twice with differing values, anchored to the duplicate', () => {
    const { node, ctx } = fieldAttr('@rel(name: "A", name: "B")');
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
      expect(result.failure[0]?.span).not.toEqual(nodePslSpan(node.syntax, ctx.sourceFile));
    }
  });

  it('rejects a named key supplied twice even when the values are equal', () => {
    const { node, ctx } = fieldAttr('@rel(name: "A", name: "A")');
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()) },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.code).toBe('PSL_INVALID_ATTRIBUTE_SYNTAX');
    }
  });
});

describe('interpretAttribute optional and default application', () => {
  it('applies a default for an absent optional argument', () => {
    const { node, ctx } = fieldAttr('@rel()');
    const spec = fieldAttribute('rel', {
      named: { map: optional(str(), 'default_fk') },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ map: 'default_fk' });
  });

  it('omits an absent optional argument with no default', () => {
    const { node, ctx } = fieldAttr('@rel()');
    const spec = fieldAttribute('rel', { named: { name: optional(str()) } });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it('overrides a default when the argument is present', () => {
    const { node, ctx } = fieldAttr('@rel(map: "explicit")');
    const spec = fieldAttribute('rel', {
      named: { map: optional(str(), 'default_fk') },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ map: 'explicit' });
  });

  it('reports a missing required argument', () => {
    const { node, ctx } = fieldAttr('@rel()');
    const spec = fieldAttribute('rel', { named: { name: str() } });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toHaveLength(1);
  });
});

describe('interpretAttribute refine', () => {
  it('runs refine on the parsed output and surfaces its diagnostics', () => {
    const { node, ctx } = fieldAttr('@rel(name: "bad")');
    const seen: string[] = [];
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()) },
      refine: (parsed, refineCtx): readonly PslDiagnostic[] => {
        if (parsed.name !== undefined) seen.push(parsed.name);
        return [
          {
            code: 'PSL_INVALID_RELATION_ATTRIBUTE',
            message: 'refine rejected the value',
            sourceId: refineCtx.sourceId,
            span: nodePslSpan(node.syntax, refineCtx.sourceFile),
          },
        ];
      },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(seen).toEqual(['bad']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.message).toBe('refine rejected the value');
    }
  });

  it('returns ok when refine reports no diagnostics', () => {
    const { node, ctx } = fieldAttr('@rel(name: "ok")');
    const spec = fieldAttribute('rel', {
      named: { name: optional(str()) },
      refine: (): readonly PslDiagnostic[] => [],
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ name: 'ok' });
  });

  it('does not run refine when an argument fails to parse', () => {
    const { node, ctx } = fieldAttr('@rel(name: "x")');
    let refined = false;
    const spec = fieldAttribute('rel', {
      named: { name: failing() },
      refine: (): readonly PslDiagnostic[] => {
        refined = true;
        return [];
      },
    });

    const result = interpretAttribute(node, spec, ctx);

    expect(refined).toBe(false);
    expect(result.ok).toBe(false);
  });
});

describe('interpretAttribute leaf purity', () => {
  it('threads a failing leaf diagnostic through the Result rather than a sink', () => {
    const { node, ctx } = fieldAttr('@rel(name: "x")');
    const spec = fieldAttribute('rel', { named: { name: failing() } });

    const result = interpretAttribute(node, spec, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toEqual([FAILING_DIAGNOSTIC]);
    }
  });
});

describe('interpretArgs', () => {
  it('binds arguments into a plain record from an argument iterable', () => {
    const { node, ctx } = fieldAttr('@rel(size: 16)');
    const span = nodePslSpan(node.syntax, ctx.sourceFile);

    const result = interpretArgs(
      node.argList()?.args() ?? [],
      { name: 'rel', positional: [], named: { size: int() } },
      ctx,
      span,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ size: 16 });
  });

  it('anchors a missing-required diagnostic to the provided span', () => {
    const { node, ctx } = fieldAttr('@rel()');
    const span = nodePslSpan(node.syntax, ctx.sourceFile);

    const result = interpretArgs(
      node.argList()?.args() ?? [],
      { name: 'rel', positional: [], named: { size: int() } },
      ctx,
      span,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toHaveLength(1);
      expect(result.failure[0]?.message).toBe(
        'Attribute "rel" is missing required argument "size"',
      );
      expect(result.failure[0]?.span).toEqual(span);
    }
  });
});
