/**
 * Seam test for the two-bucket `PslDocumentAst` shape: a flat
 * `__unspecified__` namespace can now sit beside a named one, print with
 * top-level declarations first and no `namespace __unspecified__` wrapper,
 * and round-trip through parse + interpret.
 *
 * The flat bucket carries an `enum` block because that is the payload the
 * shape exists for: a domain enum inside `namespace { … }` is the hard
 * diagnostic `PSL_ENUM_NAMESPACE_NOT_SUPPORTED`, so recovering one from a
 * database that also needs a schema wrap requires exactly this two-bucket
 * document. No production caller fills the bucket yet — domain-enum
 * recovery, a later slice, is the first producer — so the tests below pass
 * the blocks in directly.
 */
import sqlFamilyPack from '@internal/family-sql/pack';
import type { PslPrinterOptions } from '@internal/family-sql/psl-infer';
import { parseRawDefault } from '@internal/family-sql/psl-infer';
import {
  type AuthoringTypeNamespace,
  collectScalarTypeConstructors,
} from '@internal/framework-components/authoring';
import type { Codec, CodecLookup } from '@internal/framework-components/codec';
import { assembleAuthoringContributions } from '@internal/framework-components/control';
import type {
  PslDocumentAst,
  PslExtensionBlock,
  PslModel,
  PslNamespace,
  PslSpan,
} from '@internal/framework-components/psl-ast';
import {
  makePslNamespace,
  makePslNamespaceEntries,
  UNSPECIFIED_PSL_NAMESPACE_ID,
} from '@internal/framework-components/psl-ast';
import { buildSymbolTable } from '@internal/psl-parser';
import { parse } from '@internal/psl-parser/syntax';
import { printPsl } from '@internal/psl-printer';
import { interpretPslDocumentToSqlContract } from '@internal/sql-contract-psl';
import { SqlSchemaIR } from '@internal/sql-schema-ir/types';
import { assert, describe, expect, it } from 'vitest';
import {
  postgresAuthoringEntityTypes,
  postgresAuthoringPslBlockDescriptors,
} from '../../../src/core/authoring';
import { type PostgresSchema, postgresCreateNamespace } from '../../../src/core/postgres-schema';
import { buildPslDocumentAst } from '../../../src/core/psl-infer/infer-psl-contract';
import { createPostgresDefaultMapping } from '../../../src/core/psl-infer/postgres-default-mapping';
import { createPostgresTypeMap } from '../../../src/core/psl-infer/postgres-type-map';
import { inferPslAstFromFlat } from '../fixtures';

const authoringTypes = {
  Int: { kind: 'typeConstructor', output: { codecId: 'pg/int4@1', nativeType: 'int4' } },
} as const satisfies AuthoringTypeNamespace;

const assembled = assembleAuthoringContributions([
  { authoring: sqlFamilyPack.authoring },
  {
    authoring: {
      entityTypes: postgresAuthoringEntityTypes,
      type: authoringTypes,
      pslBlockDescriptors: postgresAuthoringPslBlockDescriptors,
    },
  },
]);

const target = {
  kind: 'target' as const,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  id: 'postgres',
  version: '0.0.1',
  capabilities: {},
  defaultNamespaceId: 'public',
  authoring: { type: authoringTypes },
};

const textCodec: Codec = {
  id: 'pg/text@1',
  encode: async (v: unknown) => v,
  decode: async (w: unknown) => w,
  encodeJson: (value) => value as never,
  decodeJson(json) {
    if (typeof json !== 'string') throw new Error(`expected string, got ${typeof json}`);
    return json;
  },
};

const codecLookup: CodecLookup = {
  get: (id) => (id === 'pg/text@1' ? textCodec : undefined),
  targetTypesFor: (id) => (id === 'pg/text@1' ? ['text'] : undefined),
  renderOutputTypeFor: () => undefined,
  descriptorFor: () => undefined,
};

function print(ast: PslDocumentAst): string {
  return printPsl(ast, { pslBlockDescriptors: assembled.pslBlockDescriptors });
}

function parseAndInterpret(source: string) {
  const { document, sourceFile } = parse(source);
  const { table: symbolTable } = buildSymbolTable({
    document,
    sourceFile,
    pslBlockDescriptors: assembled.pslBlockDescriptors,
  });
  return interpretPslDocumentToSqlContract({
    symbolTable,
    sourceFile,
    sourceId: 'schema.prisma',
    capabilities: {},
    target,
    scalarColumnDescriptors: collectScalarTypeConstructors(authoringTypes),
    authoringContributions: assembled,
    composedExtensionContracts: new Map(),
    createNamespace: postgresCreateNamespace,
    codecLookup,
  });
}

const ZERO_SPAN: PslSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

function idModel(name: string): PslModel {
  return {
    kind: 'model',
    name,
    fields: [
      {
        kind: 'field',
        name: 'id',
        typeName: 'Int',
        optional: false,
        list: false,
        attributes: [{ kind: 'attribute', target: 'field', name: 'id', args: [], span: ZERO_SPAN }],
        span: ZERO_SPAN,
      },
    ],
    attributes: [],
    span: ZERO_SPAN,
  };
}

function enumBlock(name: string, members: Record<string, string>): PslExtensionBlock {
  return {
    kind: 'enum',
    keyword: 'enum',
    name,
    parameters: Object.fromEntries(
      Object.entries(members).map(([memberName, value]) => [
        memberName,
        { kind: 'value' as const, raw: JSON.stringify(value), span: ZERO_SPAN },
      ]),
    ),
    blockAttributes: [
      {
        name: 'type',
        args: [{ kind: 'positional', value: `"pg/text@1"`, span: ZERO_SPAN }],
        span: ZERO_SPAN,
      },
    ],
    span: ZERO_SPAN,
  };
}

function flatBucket(blocks: readonly PslExtensionBlock[]): PslNamespace {
  return makePslNamespace({
    kind: 'namespace',
    name: UNSPECIFIED_PSL_NAMESPACE_ID,
    entries: makePslNamespaceEntries([], [], blocks),
    span: ZERO_SPAN,
  });
}

function namedBucket(name: string, models: readonly PslModel[]): PslNamespace {
  return makePslNamespace({
    kind: 'namespace',
    name,
    entries: makePslNamespaceEntries(models, [], []),
    span: ZERO_SPAN,
  });
}

describe('a document with both a flat top-level bucket and a named namespace', () => {
  // The named namespace is listed FIRST so the printer's sort has to move
  // the flat bucket ahead of it. With the flat bucket already first, a
  // stable sort would keep the order even with the comparator deleted.
  const ast: PslDocumentAst = {
    kind: 'document',
    sourceId: 't',
    namespaces: [
      namedBucket('billing', [idModel('Item')]),
      flatBucket([enumBlock('ItemStatus', { draft: 'draft', shipped: 'shipped' })]),
    ],
    span: ZERO_SPAN,
  };

  it('prints the top-level enum before the namespace block, with no __unspecified__ wrapper', () => {
    const printed = print(ast);
    expect(printed).toContain('enum ItemStatus {');
    expect(printed).toContain('namespace billing {');
    expect(printed.indexOf('enum ItemStatus {')).toBeLessThan(
      printed.indexOf('namespace billing {'),
    );
    expect(printed).not.toMatch(/namespace\s+__unspecified__/);
  });

  it('re-parses and re-interprets, with the enum recovered as a value set', () => {
    const result = parseAndInterpret(print(ast));
    if (!result.ok) {
      assert.fail(JSON.stringify(result.failure.diagnostics));
    }
    expect(result.value.domain.namespaces['billing']?.models['Item']).toBeDefined();
    const publicStorage = result.value.storage.namespaces['public'] as PostgresSchema;
    expect(publicStorage.valueSet?.['ItemStatus']).toMatchObject({
      values: ['draft', 'shipped'],
    });
  });
});

describe('an empty flat bucket beside a populated named namespace', () => {
  it('prints identically to a document with no flat bucket at all', () => {
    const named = namedBucket('billing', [idModel('Item')]);
    const withEmptyFlatBucket: PslDocumentAst = {
      kind: 'document',
      sourceId: 't',
      namespaces: [flatBucket([]), named],
      span: ZERO_SPAN,
    };
    const withoutFlatBucket: PslDocumentAst = {
      kind: 'document',
      sourceId: 't',
      namespaces: [named],
      span: ZERO_SPAN,
    };
    expect(print(withEmptyFlatBucket)).toBe(print(withoutFlatBucket));
  });
});

describe('buildPslDocumentAst and the top-level bucket', () => {
  const schemaIR = new SqlSchemaIR({
    tables: {
      widget: {
        name: 'widget',
        columns: { id: { name: 'id', nativeType: 'int4', nullable: false } },
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        uniques: [],
        indexes: [],
      },
    },
  });

  const printerOptions: PslPrinterOptions = {
    typeMap: createPostgresTypeMap(new Set()),
    defaultMapping: createPostgresDefaultMapping(),
    parseRawDefault,
  };

  const foreignKeyExtras = {
    extraRelationsByTable: new Map(),
    crossSpaceFieldNamesByTable: new Map(),
    danglingForeignKeysByTable: new Map(),
  };

  it('emits exactly one namespace when no top-level blocks are passed', () => {
    const ast = inferPslAstFromFlat(schemaIR);
    expect(ast.namespaces).toHaveLength(1);
    expect(ast.namespaces[0]?.name).toBe(UNSPECIFIED_PSL_NAMESPACE_ID);
  });

  it('keeps one namespace when the top-level block list is empty, wrap or no wrap', () => {
    const wrapped = buildPslDocumentAst(
      schemaIR,
      printerOptions,
      foreignKeyExtras,
      'app',
      undefined,
      [],
    );
    expect(wrapped.namespaces).toHaveLength(1);
    expect(wrapped.namespaces[0]?.name).toBe('app');
  });

  it('splits into a flat bucket and a named one when both have content', () => {
    const ast = buildPslDocumentAst(schemaIR, printerOptions, foreignKeyExtras, 'app', undefined, [
      enumBlock('WidgetKind', { small: 'small', large: 'large' }),
    ]);
    expect(ast.namespaces.map((n) => n.name)).toEqual([UNSPECIFIED_PSL_NAMESPACE_ID, 'app']);
    expect(Object.keys(ast.namespaces[0]?.entries?.['enum'] ?? {})).toEqual(['WidgetKind']);
    expect(Object.keys(ast.namespaces[1]?.entries?.['model'] ?? {})).toEqual(['Widget']);
  });

  it('puts top-level blocks in the single flat bucket when there is no wrap to escape', () => {
    const ast = buildPslDocumentAst(
      schemaIR,
      printerOptions,
      foreignKeyExtras,
      undefined,
      undefined,
      [enumBlock('WidgetKind', { small: 'small', large: 'large' })],
    );
    expect(ast.namespaces).toHaveLength(1);
    expect(ast.namespaces[0]?.name).toBe(UNSPECIFIED_PSL_NAMESPACE_ID);
    expect(Object.keys(ast.namespaces[0]?.entries?.['enum'] ?? {})).toEqual(['WidgetKind']);
  });
});
