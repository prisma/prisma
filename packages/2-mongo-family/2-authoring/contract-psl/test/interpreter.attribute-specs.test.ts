import type { ContractSourceDiagnostic } from '@internal/config/config-types';
import { buildSymbolTable } from '@internal/psl-parser';
import { parse } from '@internal/psl-parser/syntax';
import { describe, expect, it } from 'vitest';
import { interpretPslDocumentToMongoContract } from '../src/interpreter';

const scalarTypeCodecIds: ReadonlyMap<string, string> = new Map([
  ['String', 'mongo/string@1'],
  ['Int', 'mongo/int32@1'],
  ['ObjectId', 'mongo/objectId@1'],
]);

function diagnosticsOf(schema: string): readonly ContractSourceDiagnostic[] {
  const { document, sourceFile } = parse(schema);
  const { table } = buildSymbolTable({ document, sourceFile, pslBlockDescriptors: {} });
  const result = interpretPslDocumentToMongoContract({
    symbolTable: table,
    sourceFile,
    sourceId: 'schema.prisma',
    scalarTypeCodecIds,
    controlMutationDefaults: new Map(),
  });
  return result.ok ? [] : result.failure.diagnostics;
}

describe('field-level @id and @unique are interpreted against their specs', () => {
  it('rejects an argument on @id and no longer counts the field as the id', () => {
    const diagnostics = diagnosticsOf(`
      model Item {
        id   ObjectId @id("primary") @map("_id")
        name String
      }
    `);
    expect(diagnostics.map((d) => d.code)).toEqual([
      'PSL_INVALID_ATTRIBUTE_SYNTAX',
      'PSL_MISSING_ID_FIELD',
    ]);
  });

  it('rejects an argument on @unique and declares no index for it', () => {
    const diagnostics = diagnosticsOf(`
      model Item {
        id    ObjectId @id @map("_id")
        email String   @unique(1)
      }
    `);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'PSL_INVALID_ATTRIBUTE_SYNTAX',
        message: 'Attribute "unique" received too many positional arguments',
        span: expect.objectContaining({ start: expect.objectContaining({ line: 4 }) }),
      }),
    ]);
  });

  it('accepts bare @id and @unique', () => {
    expect(
      diagnosticsOf(`
        model Item {
          id    ObjectId @id @map("_id")
          email String   @unique
        }
      `),
    ).toEqual([]);
  });
});
