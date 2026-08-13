/**
 * Seam test for the two-bucket `PslDocumentAst` shape: a flat
 * `__unspecified__` namespace can now sit beside a named one, print with
 * top-level declarations first and no `namespace __unspecified__` wrapper,
 * and round-trip through parse + interpret. `buildPslDocumentAst` does not
 * populate the flat bucket yet (domain-enum recovery, a later slice, is the
 * first producer), so the documents below are constructed directly rather
 * than through a real producer.
 */
import {
  type AuthoringTypeNamespace,
  collectScalarTypeConstructors,
} from '@internal/framework-components/authoring';
import type { CodecLookup } from '@internal/framework-components/codec';
import { assembleAuthoringContributions } from '@internal/framework-components/control';
import type {
  PslDocumentAst,
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
import { postgresCreateNamespace } from '../../../src/core/postgres-schema';
import { inferPslAstFromFlat } from '../fixtures';

const authoringTypes = {
  Int: { kind: 'typeConstructor', output: { codecId: 'pg/int4@1', nativeType: 'int4' } },
} as const satisfies AuthoringTypeNamespace;

const assembled = assembleAuthoringContributions([
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

const codecLookup: CodecLookup = {
  get: () => undefined,
  targetTypesFor: () => undefined,
  renderOutputTypeFor: () => undefined,
  descriptorFor: () => undefined,
};

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

function makeNs(name: string, models: readonly PslModel[]): PslNamespace {
  return makePslNamespace({
    kind: 'namespace',
    name,
    entries: makePslNamespaceEntries(models, [], []),
    span: ZERO_SPAN,
  });
}

describe('a document with both a flat top-level bucket and a named namespace', () => {
  const ast: PslDocumentAst = {
    kind: 'document',
    sourceId: 't',
    namespaces: [
      makeNs(UNSPECIFIED_PSL_NAMESPACE_ID, [idModel('TopLevel')]),
      makeNs('billing', [idModel('Item')]),
    ],
    span: ZERO_SPAN,
  };

  it('prints the top-level model before the namespace block, with no __unspecified__ wrapper', () => {
    const printed = printPsl(ast);
    expect(printed.indexOf('model TopLevel {')).toBeLessThan(
      printed.indexOf('namespace billing {'),
    );
    expect(printed).not.toMatch(/namespace\s+__unspecified__/);
  });

  it('re-parses and re-interprets into both namespaces with no diagnostics', () => {
    const result = parseAndInterpret(printPsl(ast));
    if (!result.ok) {
      assert.fail(JSON.stringify(result.failure.diagnostics));
    }
    expect(result.value.domain.namespaces['public']?.models['TopLevel']).toBeDefined();
    expect(result.value.domain.namespaces['billing']?.models['Item']).toBeDefined();
  });
});

describe('an empty flat bucket beside a populated named namespace', () => {
  it('prints identically to a document with no flat bucket at all', () => {
    const named = makeNs('billing', [idModel('Item')]);
    const withEmptyFlatBucket: PslDocumentAst = {
      kind: 'document',
      sourceId: 't',
      namespaces: [makeNs(UNSPECIFIED_PSL_NAMESPACE_ID, []), named],
      span: ZERO_SPAN,
    };
    const withoutFlatBucket: PslDocumentAst = {
      kind: 'document',
      sourceId: 't',
      namespaces: [named],
      span: ZERO_SPAN,
    };
    expect(printPsl(withEmptyFlatBucket)).toBe(printPsl(withoutFlatBucket));
  });
});

describe('buildPslDocumentAst before anything fills the flat bucket', () => {
  it('emits exactly one namespace, matching the current single-bucket shape', () => {
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
    const ast = inferPslAstFromFlat(schemaIR);
    expect(ast.namespaces).toHaveLength(1);
    expect(ast.namespaces[0]?.name).toBe(UNSPECIFIED_PSL_NAMESPACE_ID);
  });
});
