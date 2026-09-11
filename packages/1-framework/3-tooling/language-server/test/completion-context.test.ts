import { parse } from '@internal/psl-parser/syntax';
import { describe, expect, it } from 'vitest';
import { classifyPslCompletionContext } from '../src/completion-context';

function classify(markedSource: string): ReturnType<typeof classifyPslCompletionContext> {
  const cursorOffset = markedSource.indexOf('|');
  expect(cursorOffset).toBeGreaterThanOrEqual(0);
  const source = `${markedSource.slice(0, cursorOffset)}${markedSource.slice(cursorOffset + 1)}`;
  const { document, sourceFile } = parse(source);

  return classifyPslCompletionContext({
    document,
    sourceFile,
    position: sourceFile.positionAt(cursorOffset),
  });
}

function expectUnsupported(markedSource: string): void {
  expect(classify(markedSource)).toMatchObject({ kind: 'unsupported' });
}

describe('classifyPslCompletionContext', () => {
  it('classifies blank document-level declaration keyword positions', () => {
    const context = classify('|');

    expect(context).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'document',
      replacementStartOffset: 0,
      offset: 0,
    });
  });

  it('classifies partial document-level declaration keyword prefixes', () => {
    const context = classify('mo|');

    expect(context).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'document',
      replacementStartOffset: 0,
      offset: 2,
    });
  });

  it('offers a declaration keyword after a closing brace on the same line', () => {
    expect(classify('model User {} mo|')).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'document',
    });
  });

  it('offers a declaration keyword immediately after a complete declaration', () => {
    expect(classify('model A {}|')).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'document',
    });
  });

  it('returns unsupported mid-header of an incomplete declaration', () => {
    expectUnsupported('model A|');
  });

  it('offers a document-level declaration keyword on a fresh line after a closed namespace', () => {
    expect(classify(['namespace auth {', '  model A {}', '}', '|'].join('\n'))).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'document',
    });
  });

  it('classifies blank namespace-body declaration keyword positions', () => {
    const context = classify(['namespace auth {', '  |', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'namespace',
    });
  });

  it('classifies partial namespace-body declaration keyword prefixes', () => {
    const context = classify(['namespace auth {', '  ty|', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'declarationKeyword',
      scope: 'namespace',
    });
  });

  it('classifies a blank model field type position', () => {
    const context = classify(['model Post {', '  author |', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'modelType',
      fieldName: 'author',
    });
  });

  it('treats the next indented line as a blank model field type position', () => {
    expect(classify(['model Post {', '  author', '  |', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'author',
    });
  });

  it('does not treat a comment after the field name as a blank model field type position', () => {
    expectUnsupported(['model Post {', '  author // |', '}'].join('\n'));
  });

  it('offers a model field type before a trailing comment', () => {
    expect(classify(['model Post {', '  author |// note', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'author',
    });
  });

  it('bounds the empty type slot at a field attribute', () => {
    expect(classify(['model Post {', '  author |@id', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'author',
    });
  });

  it('classifies a field attribute on a typeless field', () => {
    expect(classify(['model Post {', '  author @id|', '}'].join('\n'))).toMatchObject({
      kind: 'fieldAttributeName',
    });
    expect(classify(['model Post {', '  author @i|d', '}'].join('\n'))).toMatchObject({
      kind: 'fieldAttributeName',
    });
  });

  it('does not treat the cursor glued to the field name as a type slot', () => {
    expectUnsupported(['model Post {', '  author|', '}'].join('\n'));
  });

  it('classifies a partial bare model field type prefix', () => {
    const context = classify(['model Post {', '  reviewer U|', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'modelType',
      fieldName: 'reviewer',
    });
  });

  it('classifies the type position when the cursor sits inside a present field type', () => {
    expect(classify(['model Post {', '  author In|t', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'author',
    });
  });

  it('classifies namespace-qualified model field type prefixes', () => {
    expect(classify(['model Post {', '  owner auth.|', '}'].join('\n'))).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'owner',
      namespace: 'auth',
    });

    expect(classify(['model Post {', '  editor auth.U|', '}'].join('\n'))).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'editor',
      namespace: 'auth',
    });
  });

  it('classifies contract-space-qualified model field type prefixes', () => {
    expect(classify(['model Post {', '  external supabase:|', '}'].join('\n'))).toMatchObject({
      kind: 'spaceMember',
      fieldName: 'external',
      space: 'supabase',
    });

    expect(
      classify(['model Post {', '  externalUser supabase:auth.|', '}'].join('\n')),
    ).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'externalUser',
      namespace: 'auth',
      space: 'supabase',
    });

    expect(classify(['model Post {', '  owner supabase:auth.U|', '}'].join('\n'))).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'owner',
      namespace: 'auth',
      space: 'supabase',
    });
  });

  it('carries no space for a locally namespace-qualified prefix', () => {
    const context = classify(['model Post {', '  owner auth.|', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'owner',
      namespace: 'auth',
    });
    expect(context).not.toHaveProperty('space');
  });

  it('classifies a contract-space-qualified prefix without a namespace segment as a space member', () => {
    expect(classify(['model Post {', '  external supabase:U|', '}'].join('\n'))).toMatchObject({
      kind: 'spaceMember',
      fieldName: 'external',
      space: 'supabase',
    });
  });

  it('resolves the namespace when the cursor sits mid-name', () => {
    expect(classify(['model Post {', '  owner auth.Use|r', '}'].join('\n'))).toMatchObject({
      kind: 'namespaceMember',
      fieldName: 'owner',
      namespace: 'auth',
    });
  });

  it('returns unsupported in comments and trivia outside type positions', () => {
    expectUnsupported(['model Post {', '  // U|', '  id Int', '}'].join('\n'));
    expectUnsupported(['model Post {', '  |', '  id Int', '}'].join('\n'));
  });

  it('classifies field, model, and block attribute names as distinct concrete kinds with concrete owners', () => {
    const fieldContext = classify(['model Post {', '  id Int @|', '}'].join('\n'));
    expect(fieldContext).toMatchObject({
      kind: 'fieldAttributeName',
    });
    if (fieldContext.kind !== 'fieldAttributeName') {
      throw new Error('expected fieldAttributeName');
    }
    expect(fieldContext.model.name()?.name()).toBe('Post');
    expect(fieldContext.field.name()?.name()).toBe('id');
    expect(fieldContext).not.toHaveProperty('block');
    expect(fieldContext).not.toHaveProperty('blockKeyword');

    const modelContext = classify(['model Post {', '  id Int', '  @@|', '}'].join('\n'));
    expect(modelContext).toMatchObject({
      kind: 'modelAttributeName',
    });
    if (modelContext.kind !== 'modelAttributeName') {
      throw new Error('expected modelAttributeName');
    }
    expect(modelContext.model.name()?.name()).toBe('Post');
    expect(modelContext).not.toHaveProperty('field');
    expect(modelContext).not.toHaveProperty('block');
    expect(modelContext).not.toHaveProperty('blockKeyword');

    const blockContext = classify(['policy Foo {', '  @@|', '}'].join('\n'));
    expect(blockContext).toMatchObject({
      kind: 'blockAttributeName',
      blockKeyword: 'policy',
    });
    if (blockContext.kind !== 'blockAttributeName') {
      throw new Error('expected blockAttributeName');
    }
    expect(blockContext.block.keyword()?.text).toBe('policy');
    expect(blockContext).not.toHaveProperty('model');
    expect(blockContext).not.toHaveProperty('field');
  });

  it('classifies partial attribute names with a replace range over the typed segment', () => {
    const context = classify(['model Post {', '  id Int @uni|', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'fieldAttributeName',
      replacementStartOffset: 23,
      offset: 26,
    });
  });

  it('classifies top-level attribute named keys as distinct concrete kinds with concrete owners', () => {
    const fieldContext = classify(['model M {', '  id Int @map(|)', '}'].join('\n'));
    expect(fieldContext).toMatchObject({
      kind: 'fieldAttributeNamedKey',
      attributeName: 'map',
    });
    if (fieldContext.kind !== 'fieldAttributeNamedKey') {
      throw new Error('expected fieldAttributeNamedKey');
    }
    expect(fieldContext.model.name()?.name()).toBe('M');
    expect(fieldContext.field.name()?.name()).toBe('id');
    expect(fieldContext).not.toHaveProperty('block');
    expect(fieldContext).not.toHaveProperty('blockKeyword');

    const modelContext = classify(['model M {', '  @@index(fields: [id], |)', '}'].join('\n'));
    expect(modelContext).toMatchObject({
      kind: 'modelAttributeNamedKey',
      attributeName: 'index',
    });
    if (modelContext.kind !== 'modelAttributeNamedKey') {
      throw new Error('expected modelAttributeNamedKey');
    }
    expect(modelContext.model.name()?.name()).toBe('M');
    expect(modelContext).not.toHaveProperty('field');
    expect(modelContext).not.toHaveProperty('block');
    expect(modelContext).not.toHaveProperty('blockKeyword');

    const blockContext = classify(['policy Foo {', '  @@audit(|)', '}'].join('\n'));
    expect(blockContext).toMatchObject({
      kind: 'blockAttributeNamedKey',
      attributeName: 'audit',
      blockKeyword: 'policy',
    });
    if (blockContext.kind !== 'blockAttributeNamedKey') {
      throw new Error('expected blockAttributeNamedKey');
    }
    expect(blockContext.block.keyword()?.text).toBe('policy');
    expect(blockContext).not.toHaveProperty('model');
    expect(blockContext).not.toHaveProperty('field');
  });

  it('does not classify attribute values or nested argument positions as named keys', () => {
    expectUnsupported(['model Post {', '  id Int @map(name: value|)', '}'].join('\n'));
    expectUnsupported(['model Post {', '  id Int @default(autoincrement(|))', '}'].join('\n'));
    expectUnsupported(['model Post {', '  authorId Int @relation(fields: [|])', '}'].join('\n'));
  });

  it('bounds field attribute completion to the active attribute span', () => {
    expectUnsupported(['model Post {', '  id Int @id |', '}'].join('\n'));
  });

  it('keeps attribute completion active at the attribute end offset', () => {
    expect(classify(['model Post {', '  id Int @id|', '}'].join('\n'))).toMatchObject({
      kind: 'fieldAttributeName',
    });
    expect(classify(['model Post {', '  id Int', '  @@id|', '}'].join('\n'))).toMatchObject({
      kind: 'modelAttributeName',
    });
    expect(classify(['policy Foo {', '  @@audit|', '}'].join('\n'))).toMatchObject({
      kind: 'blockAttributeName',
      blockKeyword: 'policy',
    });
  });

  it('classifies a composite-type field type position', () => {
    expect(classify(['type Address {', '  city |', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'city',
    });

    expect(classify(['type Address {', '  city U|', '}'].join('\n'))).toMatchObject({
      kind: 'modelType',
      fieldName: 'city',
    });
  });

  it('classifies blank generic block key positions', () => {
    const context = classify(['policy UserAccess {', '  |', '}'].join('\n'));
    expect(context).toMatchObject({
      kind: 'genericBlockKey',
      blockKeyword: 'policy',
    });
    if (context.kind !== 'genericBlockKey') throw new Error('expected genericBlockKey');
    expect(context.block.keyword()?.text).toBe('policy');
  });

  it('carries the enclosing block AST node for generic block key prefixes', () => {
    const context = classify(['policy UserAccess {', '  on = User', '  wh|', '}'].join('\n'));
    expect(context).toMatchObject({
      kind: 'genericBlockKey',
      blockKeyword: 'policy',
    });
    if (context.kind !== 'genericBlockKey') throw new Error('expected genericBlockKey');
    expect(context.block.keyword()?.text).toBe('policy');
    expect([...context.block.entries()].map((entry) => entry.key()?.name())).toEqual(['on', 'wh']);
  });

  it('classifies generic block value positions after the equals sign', () => {
    expect(classify(['datasource db {', '  provider = |', '}'].join('\n'))).toMatchObject({
      kind: 'genericBlockValue',
      blockKeyword: 'datasource',
    });
  });

  it('classifies a generic block value position flush against the equals sign', () => {
    expect(classify(['datasource db {', '  provider =|', '}'].join('\n'))).toMatchObject({
      kind: 'genericBlockValue',
      blockKeyword: 'datasource',
    });
  });

  it('classifies a partial generic block value prefix', () => {
    expect(classify(['datasource db {', '  provider = fo|', '}'].join('\n'))).toMatchObject({
      kind: 'genericBlockValue',
      blockKeyword: 'datasource',
    });
  });

  it('classifies the gap before = as a generic block key with an empty source range', () => {
    const context = classify(['datasource db {', '  url |= "x"', '}'].join('\n'));

    expect(context).toMatchObject({
      kind: 'genericBlockKey',
      blockKeyword: 'datasource',
    });
    // rust-analyzer `source_range()` shape: the cursor sits in whitespace, so the
    // edit range is empty at the cursor rather than synthesising the `url` key.
    if (context.kind === 'genericBlockKey') {
      expect(context.replacementStartOffset).toBe(context.offset);
    }
  });

  it('returns unsupported inside type constructor arguments', () => {
    expectUnsupported(['model Embedding {', '  vector Vector(|)', '}'].join('\n'));
  });

  it('returns unsupported outside model field type prefixes', () => {
    expectUnsupported(['model Post {', '  |id Int', '}'].join('\n'));
    expectUnsupported(['model Post {', '  id Int |', '}'].join('\n'));
  });

  it('returns unsupported for invalid over-qualified names', () => {
    expectUnsupported(['model Post {', '  owner auth.domain.U|', '}'].join('\n'));
    expectUnsupported(['model Post {', '  owner supabase:auth:U|', '}'].join('\n'));
  });
});
