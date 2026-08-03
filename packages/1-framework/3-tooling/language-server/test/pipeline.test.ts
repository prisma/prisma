import { buildSymbolTable } from '@internal/psl-parser';
import { parse } from '@internal/psl-parser/syntax';
import { describe, expect, it } from 'vitest';
import { mapParseDiagnostics } from '../src/diagnostic-mapping';
import { runPipeline } from '../src/pipeline';

const scalarTypes = ['String', 'Int', 'Boolean', 'DateTime'] as const;
const pipelineInputs = { scalarTypes, pslBlockDescriptors: {} };

describe('runPipeline', () => {
  it('reports a duplicate top-level declaration as PSL_DUPLICATE_DECLARATION', () => {
    const source = [
      'model User {',
      '  id Int @id',
      '}',
      '',
      'model User {',
      '  id Int @id',
      '}',
    ].join('\n');

    const { diagnostics } = runPipeline(source, pipelineInputs);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('PSL_DUPLICATE_DECLARATION');
  });

  it('reports an over-qualified field type as PSL_INVALID_QUALIFIED_TYPE', () => {
    const source = ['model Profile {', '  user a.b.c', '}'].join('\n');

    const { diagnostics } = runPipeline(source, pipelineInputs);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'PSL_INVALID_QUALIFIED_TYPE',
    );
  });

  it('produces no symbol-table diagnostics for a clean schema', () => {
    const source = ['model User {', '  id Int @id', '}', ''].join('\n');

    const { diagnostics } = runPipeline(source, pipelineInputs);

    expect(diagnostics).toEqual([]);
  });

  it('does not throw on malformed, half-typed input and still exposes the artifacts', () => {
    const source = 'model User {\n  id ';

    const result = runPipeline(source, pipelineInputs);

    expect(result.document).toBeDefined();
    expect(result.sourceFile).toBeDefined();
    expect(result.symbolTable).toBeDefined();
  });

  it('merges parse then symbol-table diagnostics, mapped the same way the build composes them', () => {
    const source = [
      'model User {',
      '  id Int @id',
      '}',
      '',
      'model User {',
      '  id Int @id',
      '}',
    ].join('\n');

    const { document, sourceFile, diagnostics: parseDiagnostics } = parse(source);
    const { diagnostics: symbolTableDiagnostics } = buildSymbolTable({
      document,
      sourceFile,
      pslBlockDescriptors: {},
    });

    const { diagnostics } = runPipeline(source, pipelineInputs);

    expect(diagnostics).toEqual(
      mapParseDiagnostics([...parseDiagnostics, ...symbolTableDiagnostics]),
    );
  });
});
