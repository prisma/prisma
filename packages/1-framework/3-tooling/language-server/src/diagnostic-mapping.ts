import type {
  ContractSourceDiagnostic,
  ContractSourceDiagnosticSpan,
} from '@internal/config/config-types';
import type { ParseDiagnostic, Range, SourceFile } from '@internal/psl-parser/syntax';

export const ParseDiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
} as const;

export interface LspDiagnostic {
  readonly range: Range;
  readonly message: string;
  readonly code: string;
  readonly severity: number;
}

export function mapParseDiagnostics(
  diagnostics: readonly ParseDiagnostic[],
): readonly LspDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    range: diagnostic.range,
    message: diagnostic.message,
    code: diagnostic.code,
    severity: ParseDiagnosticSeverity.Error,
  }));
}

// LSP has no span-less diagnostics; the tsserver convention anchors them at
// the top of the document rather than dropping them.
const documentStartRange: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 1 },
};

export function mapInterpreterDiagnostics(
  diagnostics: readonly ContractSourceDiagnostic[],
  sourceFile: SourceFile,
): readonly LspDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    range:
      diagnostic.span === undefined
        ? documentStartRange
        : pslSpanToRange(diagnostic.span, sourceFile),
    message: diagnostic.message,
    code: diagnostic.code,
    severity: ParseDiagnosticSeverity.Error,
  }));
}

// Inverse of psl-parser's rangeToPslSpan, which derives every span position
// from a source offset: recovering the 0-based LSP position from that same
// offset round-trips exactly.
function pslSpanToRange(span: ContractSourceDiagnosticSpan, sourceFile: SourceFile): Range {
  return {
    start: sourceFile.positionAt(span.start.offset),
    end: sourceFile.positionAt(span.end.offset),
  };
}
