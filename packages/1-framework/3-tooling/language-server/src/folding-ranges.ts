import {
  type DocumentAst,
  NamespaceDeclarationAst,
  type NamespaceMemberAst,
  type SourceFile,
  type TypesBlockAst,
} from '@internal/psl-parser/syntax';
import { type FoldingRange, FoldingRangeKind } from 'vscode-languageserver';

type Declaration = NamespaceMemberAst | TypesBlockAst | NamespaceDeclarationAst;

/**
 * Computes folding ranges for block declarations in a PSL document.
 *
 * Block types that produce folding ranges:
 * - model (e.g., `model User { ... }`)
 * - composite type (e.g., `type Address { ... }`)
 * - namespace (e.g., `namespace billing { ... }`)
 * - generic blocks (generator, datasource, extension blocks)
 * - types block (e.g., `types { ... }`)
 *
 * The range spans from the line containing `{` to the line containing `}`.
 */
export function computeFoldingRanges(
  document: DocumentAst,
  sourceFile: SourceFile,
): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  collectFoldingRanges(document, sourceFile, ranges);
  return ranges;
}

function collectFoldingRanges(
  document: DocumentAst,
  sourceFile: SourceFile,
  ranges: FoldingRange[],
): void {
  for (const declaration of document.declarations()) {
    addFoldingRange(declaration, sourceFile, ranges);

    const namespace = NamespaceDeclarationAst.cast(declaration.syntax);
    if (namespace !== undefined) {
      for (const nested of namespace.declarations()) {
        addFoldingRange(nested, sourceFile, ranges);
      }
    }
  }
}

function addFoldingRange(
  declaration: Declaration,
  sourceFile: SourceFile,
  ranges: FoldingRange[],
): void {
  const lbrace = declaration.lbrace();
  const rbrace = declaration.rbrace();

  if (lbrace === undefined || rbrace === undefined) {
    return;
  }

  const startLine = sourceFile.positionAt(lbrace.offset).line;
  const endLine = sourceFile.positionAt(rbrace.offset).line;

  ranges.push({
    startLine,
    endLine,
    kind: FoldingRangeKind.Region,
  });
}
