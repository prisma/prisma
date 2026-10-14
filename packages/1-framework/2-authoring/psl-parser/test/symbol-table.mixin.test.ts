import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { PslSources, type Range } from '../src/source-file';
import { buildSymbolTable } from '../src/symbol-table';

function build(...texts: string[]) {
  const parsed = texts.map((text, index) => parse(text, `${index}.psl`));
  const sources = new PslSources(
    parsed.map(
      ({ document, sources }) => [document.syntax, sources.sourceFileFor(document.syntax)] as const,
    ),
  );
  const result = buildSymbolTable({ documents: parsed.map(({ document }) => document), sources });
  return {
    ...result,
    topLevel: result.symbolTable.topLevel,
    parseDiagnostics: parsed.flatMap(({ diagnostics }) => diagnostics),
  };
}

function rangeOf(source: string, snippet: string, occurrence = 0): Range {
  let offset = -1;
  for (let found = 0; found <= occurrence; found++) offset = source.indexOf(snippet, offset + 1);
  if (offset < 0) throw new Error(`"${snippet}" is not in the source`);
  const before = source.slice(0, offset).split('\n');
  const line = before.length - 1;
  const character = before[line]?.length ?? 0;
  return {
    start: { line, character },
    end: { line, character: character + snippet.length },
  };
}

function lines(...parts: string[]): string {
  return parts.join('\n');
}

describe('buildSymbolTable() given mixin declarations', () => {
  it('collects a mixin of each keyword into the mixins record, with fields or entries', () => {
    const { topLevel, diagnostics } = build(
      lines(
        'model mixin Timestamps {',
        '  createdAt DateTime @default(now())',
        '  @@index([createdAt])',
        '}',
        'type mixin Geo {',
        '  lat Float',
        '}',
        'enum mixin BaseRoles {',
        '  ADMIN @map("admin")',
        '  USER',
        '}',
        'policy mixin OwnerRead {',
        '  roles = [authenticated]',
        '  @@map("owner")',
        '}',
      ),
    );

    expect(diagnostics).toEqual([]);
    expect(Object.keys(topLevel.mixins)).toEqual(['Timestamps', 'Geo', 'BaseRoles', 'OwnerRead']);
    expect(
      Object.values(topLevel.mixins).map((mixin) => ({
        kind: mixin.kind,
        name: mixin.name,
        keyword: mixin.keyword,
        fields: Object.keys(mixin.fields),
        entries: mixin.entries.map((entry) => entry.key()?.name()),
        attributes: mixin.attributes.map((attribute) => attribute.name),
      })),
    ).toEqual([
      {
        kind: 'mixin',
        name: 'Timestamps',
        keyword: 'model',
        fields: ['createdAt'],
        entries: [],
        attributes: ['index'],
      },
      { kind: 'mixin', name: 'Geo', keyword: 'type', fields: ['lat'], entries: [], attributes: [] },
      {
        kind: 'mixin',
        name: 'BaseRoles',
        keyword: 'enum',
        fields: [],
        entries: ['ADMIN', 'USER'],
        attributes: [],
      },
      {
        kind: 'mixin',
        name: 'OwnerRead',
        keyword: 'policy',
        fields: [],
        entries: ['roles'],
        attributes: ['map'],
      },
    ]);
    expect(Object.keys(topLevel.models)).toEqual([]);
    expect(Object.keys(topLevel.compositeTypes)).toEqual([]);
    expect(Object.keys(topLevel.blocks)).toEqual([]);
  });

  it('keeps the node and the span of a mixin and resolves its fields like model fields', () => {
    const source = 'model mixin Timestamps {\n  createdAt DateTime? @default(now())\n}';
    const mixin = build(source).topLevel.mixins['Timestamps'];

    expect(mixin?.node.name()?.name()).toBe('Timestamps');
    expect(mixin?.span).toEqual({
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: source.length, line: 3, column: 2 },
    });
    expect(mixin?.fields['createdAt']).toMatchObject({
      kind: 'field',
      name: 'createdAt',
      typeName: 'DateTime',
      optional: true,
    });
    expect(mixin?.fields['createdAt']?.attributes.map((attribute) => attribute.name)).toEqual([
      'default',
    ]);
  });

  it('collects a mixin declared in a namespace into that namespace', () => {
    const { topLevel, diagnostics } = build(
      'namespace auth {\n  model mixin Timestamps {\n    createdAt DateTime\n  }\n}',
    );

    expect(diagnostics).toEqual([]);
    expect(Object.keys(topLevel.mixins)).toEqual([]);
    expect(Object.keys(topLevel.namespaces['auth']?.mixins ?? {})).toEqual(['Timestamps']);
    expect(Object.keys(topLevel.namespaces['auth']?.models ?? {})).toEqual([]);
  });

  it('names the mixin as the owner of a field with an invalid qualified type', () => {
    const source = 'model mixin Owned {\n  owner a.b.c.User\n}';
    const { diagnostics } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_INVALID_QUALIFIED_TYPE',
        message:
          'Field "Owned.owner" has an invalid qualified type "a.b.c.User"; use at most one namespace qualifier (e.g. "ns.TypeName")',
        filename: '0.psl',
        range: rangeOf(source, 'a.b.c.User'),
      },
    ]);
  });

  it('reports a field declared twice in a mixin at the later field', () => {
    const source = 'model mixin T {\n  a Int\n  a String\n}';
    const { diagnostics, topLevel } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_DUPLICATE_DECLARATION',
        message: 'Duplicate declaration of "a"',
        filename: '0.psl',
        range: rangeOf(source, 'a', 1),
      },
    ]);
    expect(topLevel.mixins['T']?.fields['a']?.typeName).toBe('Int');
  });

  it.each([
    ['a model', 'model User {\n}\nmodel mixin User {\n}', 'models'],
    ['a composite type', 'type User {\n}\nenum mixin User {\n}', 'compositeTypes'],
    ['a block', 'enum User {\n}\nmodel mixin User {\n}', 'blocks'],
    ['another mixin', 'model mixin User {\n}\nenum mixin User {\n}', 'mixins'],
  ] as const)(
    'reports a mixin that shares its name with %s declared first',
    (_kind, source, record) => {
      const { diagnostics, topLevel } = build(source);

      expect(diagnostics).toEqual([
        {
          code: 'PSL_DUPLICATE_DECLARATION',
          message: 'Duplicate declaration of "User"',
          filename: '0.psl',
          range: rangeOf(source, 'User', 1),
        },
      ]);
      expect(Object.keys(topLevel[record])).toEqual(['User']);
      expect(topLevel.mixins['User']?.keyword).toBe(record === 'mixins' ? 'model' : undefined);
    },
  );

  it('reports a declaration that shares its name with a mixin declared first', () => {
    const source = 'model mixin User {\n}\nmodel User {\n}';
    const { diagnostics, topLevel } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_DUPLICATE_DECLARATION',
        message: 'Duplicate declaration of "User"',
        filename: '0.psl',
        range: rangeOf(source, 'User', 1),
      },
    ]);
    expect(Object.keys(topLevel.mixins)).toEqual(['User']);
    expect(Object.keys(topLevel.models)).toEqual([]);
  });

  it('checks a mixin name against the models, types, blocks and mixins of its namespace', () => {
    const source = lines(
      'namespace a {',
      '  model User {',
      '  }',
      '  model mixin User {',
      '  }',
      '  enum mixin Roles {',
      '  }',
      '  enum Roles {',
      '  }',
      '}',
      'namespace b {',
      '  model mixin User {',
      '  }',
      '}',
      'model mixin User {',
      '}',
    );
    const { diagnostics, topLevel } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_DUPLICATE_DECLARATION',
        message: 'Duplicate declaration of "User"',
        filename: '0.psl',
        range: rangeOf(source, 'User', 1),
      },
      {
        code: 'PSL_DUPLICATE_DECLARATION',
        message: 'Duplicate declaration of "Roles"',
        filename: '0.psl',
        range: rangeOf(source, 'Roles', 1),
      },
    ]);
    expect(Object.keys(topLevel.namespaces['a']?.mixins ?? {})).toEqual(['Roles']);
    expect(Object.keys(topLevel.namespaces['a']?.blocks ?? {})).toEqual([]);
    expect(Object.keys(topLevel.namespaces['b']?.mixins ?? {})).toEqual(['User']);
    expect(Object.keys(topLevel.mixins)).toEqual(['User']);
  });
});

describe('buildSymbolTable() given a block that includes a mixin', () => {
  it('keeps only the members written in the block and reports nothing for the inclusion', () => {
    const { topLevel, diagnostics } = build(
      lines(
        'model mixin Timestamps {',
        '  createdAt DateTime',
        '  @@index([createdAt])',
        '}',
        'enum mixin BaseRoles {',
        '  ADMIN',
        '}',
        'model User {',
        '  id Int',
        '  +Timestamps',
        '  +Missing',
        '  @@map("users")',
        '}',
        'type Address {',
        '  +Timestamps',
        '  street String',
        '}',
        'enum Role {',
        '  +BaseRoles',
        '  GUEST',
        '}',
      ),
    );

    expect(diagnostics).toEqual([]);
    expect(Object.keys(topLevel.models['User']?.fields ?? {})).toEqual(['id']);
    expect(topLevel.models['User']?.attributes.map((attribute) => attribute.name)).toEqual(['map']);
    expect(Object.keys(topLevel.compositeTypes['Address']?.fields ?? {})).toEqual(['street']);
    expect(topLevel.blocks['Role']?.entries.map((entry) => entry.key()?.name())).toEqual(['GUEST']);
  });
});

describe('buildSymbolTable() given a mixin written without its block keyword', () => {
  const message = (name: string) =>
    `A mixin starts with the keyword of the block it is for, for example "model mixin ${name}"`;

  it('reports it at the keyword, collects it in no record and leaves its name free', () => {
    const source = lines('mixin X {', '  a = 1', '}', 'model X {', '  id Int', '}');
    const { topLevel, diagnostics } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message: message('X'),
        filename: '0.psl',
        range: rangeOf(source, 'mixin'),
      },
    ]);
    expect(Object.keys(topLevel.blocks)).toEqual([]);
    expect(Object.keys(topLevel.mixins)).toEqual([]);
    expect(Object.keys(topLevel.models)).toEqual(['X']);
  });

  it('reports it in a namespace, collects it in no record and leaves its name free', () => {
    const source = lines(
      'namespace app {',
      '  model X {',
      '    id Int',
      '  }',
      '  mixin X {',
      '  }',
      '}',
    );
    const { topLevel, diagnostics } = build(source);
    const app = topLevel.namespaces['app'];

    expect(diagnostics).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message: message('X'),
        filename: '0.psl',
        range: rangeOf(source, 'mixin'),
      },
    ]);
    expect(Object.keys(app?.blocks ?? {})).toEqual([]);
    expect(Object.keys(app?.mixins ?? {})).toEqual([]);
    expect(Object.keys(app?.models ?? {})).toEqual(['X']);
  });

  it('reports a mixin whose block keyword is mixin at that keyword and collects it in no record', () => {
    const source = lines('mixin mixin X {', '  a = 1', '}', 'model X {', '  id Int', '}');
    const { topLevel, diagnostics } = build(source);

    expect(diagnostics).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message: message('X'),
        filename: '0.psl',
        range: rangeOf(source, 'mixin'),
      },
    ]);
    expect(Object.keys(topLevel.mixins)).toEqual([]);
    expect(Object.keys(topLevel.models)).toEqual(['X']);
  });

  it('names the placeholder Name when the declaration has no name', () => {
    const { diagnostics } = build('mixin {\n}');

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([message('Name')]);
  });
});
