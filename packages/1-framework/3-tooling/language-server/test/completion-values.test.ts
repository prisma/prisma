import type { AuthoringPslBlockDescriptorNamespace } from '@internal/framework-components/authoring';
import {
  assembleAuthoringContributions,
  assembleControlMutationDefaults,
} from '@internal/framework-components/control';
import {
  type AttributeCtx,
  blockAttribute,
  bool,
  buildSymbolTable,
  entityRef,
  fieldAttribute,
  funcCall,
  identifier,
  int,
  json,
  list,
  modelAttribute,
  num,
  oneOf,
  optional,
  type RejectingArgType,
  record,
  str,
} from '@internal/psl-parser';
import { parse } from '@internal/psl-parser/syntax';
import { describe, expect, it, vi } from 'vitest';
import { InsertTextFormat } from 'vscode-languageserver';
import { classifyPslCompletionContext } from '../src/completion-context';
import { providePslCompletionItems } from '../src/completion-provider';

const emptyTabStop1 = '$' + '{1:}';
const emptyTabStop2 = '$' + '{2:}';
const rejectedParse = vi.fn(() => {
  throw new Error('completion must not parse');
});
const rejecting: RejectingArgType<never, AttributeCtx> = {
  kind: 'rejecting',
  label: 'unavailable',
  message: 'No available values',
  parse: rejectedParse,
};
const direction = oneOf(identifier('Asc'), identifier('Desc'));
const ordered = funcCall('ordered', {
  positional: [{ key: 'direction', type: direction }],
  named: { required: list(bool()), optional: optional(str()), direction },
});
const signature = {
  positional: [{ key: 'value', type: oneOf(identifier('First'), identifier('Second')) }],
  named: {
    mode: oneOf(identifier('Asc'), identifier('Desc'), identifier('Asc')),
    fixed: oneOf(str('quoted"value'), num(-1), bool(), identifier('Fixed')),
    flags: list(bool()),
    records: record(list(bool())),
    choice: oneOf(ordered, funcCall('empty', {})),
    nested: funcCall('wrap', {
      positional: [{ key: 'value', type: list(ordered) }],
      named: { extra: optional(bool()) },
    }),
    overlap: oneOf(
      funcCall('same', { named: { first: bool() } }),
      funcCall('same', { named: { second: bool() } }),
    ),
    all: oneOf(str(), identifier('Alpha'), bool(), num(), identifier('Alpha')),
    none: oneOf(str(), num(), int(), json(), entityRef(), rejecting),
    rejected: rejecting,
    recordValues: record(bool()),
    unionLists: oneOf(list(identifier('A')), list(identifier('B')), list(identifier('A'))),
    format: funcCall('format', {
      named: { text: str(), options: record(str()), enabled: optional(bool(), true) },
    }),
  },
};
const fieldSpec = fieldAttribute('probe', signature);
const modelSpec = modelAttribute('probe', signature);
const blockSpec = blockAttribute('probe', signature);
const authoringContributions = assembleAuthoringContributions([
  {
    id: 'completion-fixture',
    authoring: {
      attributeSpecs: { field: { probe: () => fieldSpec }, model: { probe: () => modelSpec } },
    },
  },
]);
const pslBlockDescriptors: AuthoringPslBlockDescriptorNamespace = {
  policy: {
    kind: 'pslBlock',
    keyword: 'policy',
    discriminator: 'completion-policy',
    name: { required: true },
    parameters: {},
    attributes: { probe: () => blockSpec },
  },
};

function complete(markedSource: string, snippets = false) {
  const offset = markedSource.indexOf('|');
  expect(offset).toBeGreaterThanOrEqual(0);
  const source = markedSource.slice(0, offset) + markedSource.slice(offset + 1);
  const { document, sourceFile } = parse(source);
  const { table: symbolTable } = buildSymbolTable({ document, sourceFile, pslBlockDescriptors });
  const items = providePslCompletionItems({
    context: classifyPslCompletionContext({
      document,
      sourceFile,
      position: sourceFile.positionAt(offset),
    }),
    sourceFile,
    candidates: {
      scalarTypes: ['String'],
      pslBlockDescriptors,
      symbolTable,
      authoringContributions,
      controlMutationDefaults: assembleControlMutationDefaults([]),
    },
    clientSupportsSnippets: snippets,
  });
  return {
    items,
    labels: items.map((item) => item.label),
    apply(label: string) {
      const edit = items.find((item) => item.label === label)?.textEdit;
      expect(edit).toBeDefined();
      if (edit === undefined || !('range' in edit)) throw new Error('missing text edit');
      return (
        source.slice(0, sourceFile.offsetAt(edit.range.start)) +
        edit.newText +
        source.slice(sourceFile.offsetAt(edit.range.end))
      );
    },
  };
}

function field(args: string, snippets = false) {
  return complete(`model Example {\n  value String @probe(${args})\n}`, snippets);
}

describe('recursive attribute values', () => {
  it.each([
    ['mode: |', ['Asc', 'Desc']],
    ['mode: A|sc', ['Asc', 'Desc']],
    ['fixed: |', ['"quoted\\"value"', '-1', 'true', 'false', 'Fixed']],
    ['fixed: tr|ue', ['"quoted\\"value"', '-1', 'true', 'false', 'Fixed']],
    ['flags: [|]', ['true', 'false']],
    ['flags: [true, |]', ['true', 'false']],
    ['flags: [fa|lse, true]', ['true', 'false']],
    ['records: { key: [|] }', ['true', 'false']],
    ['records: { "key": [true, |] }', ['true', 'false']],
    ['records: { | }', []],
    ['records: { ke|y: [] }', []],
    ['all: |', ['Alpha', 'true', 'false']],
    ['none: |', []],
    ['rejected: |', []],
    ['recordValues: { enabled: | }', ['true', 'false']],
    ['recordValues: { enabled: true, next: | }', ['true', 'false']],
    ['unionLists: [|]', ['A', 'B']],
    ['flags: [|false]', ['true', 'false']],
  ])('completes %s', (args, expected) => {
    expect(field(args).labels).toEqual(expected);
  });

  it.each([
    'model Example { value String @probe(mode: |',
    'model Example { value String @probe(flags: [|',
    'model Example { value String @probe(records: { key: [|',
  ])('completes incomplete EOF %s', (source) => {
    expect(complete(source).labels).toEqual(
      source.includes('mode:') ? ['Asc', 'Desc'] : ['true', 'false'],
    );
  });

  it('never invokes combinator parsing to select alternatives', () => {
    expect(field('none: |').items).toEqual([]);
    expect(rejectedParse).not.toHaveBeenCalled();
  });

  it('replaces an unfinished string token at EOF', () => {
    expect(
      complete('model Example { value String @probe(fixed: "ol|').apply('"quoted\\"value"'),
    ).toBe('model Example { value String @probe(fixed: "quoted\\"value"');
  });

  it('preserves declaration order through client sort keys', () => {
    const items = field('First, |').items;
    expect(
      [...items]
        .sort((a, b) => (a.sortText ?? '').localeCompare(b.sortText ?? ''))
        .map((item) => item.label),
    ).toEqual(Object.keys(signature.named));
  });

  it('offers positional values alongside available keys', () => {
    expect(field('|').labels).toEqual(['First', 'Second', ...Object.keys(signature.named)]);
  });

  it('does not advance the positional slot for named arguments', () => {
    expect(field('mode: Asc, |').labels).toEqual([
      'First',
      'Second',
      ...Object.keys(signature.named).filter((key) => key !== 'mode'),
    ]);
  });

  it('advances the positional slot only once', () => {
    expect(field('First, |').labels).toEqual(Object.keys(signature.named));
  });

  it.each([
    'model Example { value String @probe(mode: Asc)| }',
    'model Example { value String @probe(mode: Asc)|',
    'model Example { value String @probe(flags: []|) }',
    'model Example { value String @probe(choice: empty()|) }',
    'model Example { value String @probe(records: {}|) }',
    'model Example { value String @probe(mode: Asc // |\n) }',
  ])('does not complete after a closed delimiter or inside a comment: %s', (source) => {
    expect(complete(source).items).toEqual([]);
  });

  it('replaces the full identifier token', () => {
    expect(field('mode: A|sc').apply('Desc')).toBe(
      'model Example {\n  value String @probe(mode: Desc)\n}',
    );
  });

  it('replaces the full quoted literal token without duplicating quotes', () => {
    expect(field('fixed: "ol|d"').apply('"quoted\\"value"')).toBe(
      'model Example {\n  value String @probe(fixed: "quoted\\"value")\n}',
    );
  });

  it('replaces a whole negative numeric token', () => {
    expect(field('fixed: -1|2').apply('-1')).toBe(
      'model Example {\n  value String @probe(fixed: -1)\n}',
    );
  });

  it.each(['model Example { @@probe(mode: |) }', 'policy Example { @@probe(mode: |) }'])(
    'completes values for each concrete owner: %s',
    (source) => {
      expect(complete(source).labels).toEqual(['Asc', 'Desc']);
    },
  );
});

describe('recursive function arguments', () => {
  it('offers function calls from every alternative', () => {
    expect(field('choice: |').labels).toEqual(['ordered', 'empty']);
  });

  it('inserts only required arguments with empty tab stops', () => {
    const result = field('choice: |', true);
    expect(result.items.map((item) => [item.label, item.insertTextFormat])).toEqual([
      ['ordered', InsertTextFormat.Snippet],
      ['empty', InsertTextFormat.Snippet],
    ]);
    expect(result.apply('ordered')).toBe(
      `model Example {\n  value String @probe(choice: ordered(${emptyTabStop1}, required: [${emptyTabStop2}]))\n}`,
    );
    expect(result.apply('empty')).toBe(
      'model Example {\n  value String @probe(choice: empty())\n}',
    );
  });

  it('uses empty string and record tab stops and omits optional defaults', () => {
    expect(field('format: |', true).apply('format')).toBe(
      `model Example {\n  value String @probe(format: format(text: "${emptyTabStop1}", options: { ${emptyTabStop2} }))\n}`,
    );
  });

  it('uses plain function names without snippet syntax for ordinary clients', () => {
    const result = field('choice: |');
    expect(result.items.every((item) => item.insertTextFormat !== InsertTextFormat.Snippet)).toBe(
      true,
    );
    expect(result.apply('ordered')).toBe(
      'model Example {\n  value String @probe(choice: ordered)\n}',
    );
  });

  it('preserves existing function parentheses and arguments', () => {
    expect(field('choice: or|dered(Asc, required: [true])', true).apply('ordered')).toBe(
      'model Example {\n  value String @probe(choice: ordered(Asc, required: [true]))\n}',
    );
  });

  it('offers positional function values and declaration-ordered keys', () => {
    expect(field('choice: ordered(|)').labels).toEqual([
      'Asc',
      'Desc',
      'required',
      'optional',
      'direction',
    ]);
  });

  it('filters supplied keys and retains the currently edited key', () => {
    expect(field('choice: ordered(Asc, optional: "text", req|uired: [])').labels).toEqual([
      'required',
      'direction',
    ]);
  });

  it('binds named function values without advancing positional slots', () => {
    expect(field('choice: ordered(optional: "text", |)').labels).toEqual([
      'Asc',
      'Desc',
      'required',
      'direction',
    ]);
  });

  it('completes nested list values in function named arguments', () => {
    expect(field('choice: ordered(Asc, required: [|])').labels).toEqual(['true', 'false']);
  });

  it('recurses through function, list, and function arguments', () => {
    expect(field('nested: wrap([ordered(direction: |)])').labels).toEqual(['Asc', 'Desc']);
  });

  it('completes a missing nested expression at EOF', () => {
    expect(
      complete('model Example { value String @probe(nested: wrap([ordered(direction: |').labels,
    ).toEqual(['Asc', 'Desc']);
  });

  it('keeps same-name alternatives with different snippet edits', () => {
    const result = field('overlap: |', true);
    expect(result.items.map((item) => item.textEdit?.newText)).toEqual([
      `same(first: ${emptyTabStop1})`,
      `same(second: ${emptyTabStop1})`,
    ]);
  });

  it('combines signatures of matching function alternatives', () => {
    expect(field('overlap: same(|)').labels).toEqual(['first', 'second']);
  });
});
