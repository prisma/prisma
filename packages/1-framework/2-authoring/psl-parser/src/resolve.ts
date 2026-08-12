import type { PslSpan } from '@internal/framework-components/psl-ast';
import type { Position, Range, SourceFile } from './source-file';
import type {
  AttributeArgListAst,
  FieldAttributeAst,
  ModelAttributeAst,
} from './syntax/ast/attributes';
import type { ExpressionAst } from './syntax/ast/expressions';
import type { QualifiedNameAst } from './syntax/ast/qualified-name';
import type { TypeAnnotationAst } from './syntax/ast/type-annotation';
import { printSyntax } from './syntax/ast-helpers';
import type { SyntaxNode } from './syntax/red';

export interface ResolvedAttributeArg {
  readonly kind: 'positional' | 'named';
  readonly name?: string;
  readonly value: string;
  readonly expression?: ExpressionAst;
  readonly span: PslSpan;
}

export interface ResolvedAttribute {
  readonly name: string;
  readonly args: readonly ResolvedAttributeArg[];
  readonly span: PslSpan;
}

export interface ResolvedTypeConstructorCall {
  readonly path: readonly string[];
  readonly args: readonly ResolvedAttributeArg[];
  readonly span: PslSpan;
}

export function readResolvedAttribute(
  attribute: FieldAttributeAst | ModelAttributeAst,
  sourceFile: SourceFile,
): ResolvedAttribute {
  return {
    name: attributeName(attribute.name()),
    args: readResolvedArgList(attribute.argList(), sourceFile),
    span: nodePslSpan(attribute.syntax, sourceFile),
  };
}

export function readResolvedAttributes(
  attributes: Iterable<FieldAttributeAst | ModelAttributeAst>,
  sourceFile: SourceFile,
): readonly ResolvedAttribute[] {
  return Array.from(attributes, (attribute) => readResolvedAttribute(attribute, sourceFile));
}

export function readResolvedConstructorCall(
  annotation: TypeAnnotationAst | undefined,
  sourceFile: SourceFile,
): ResolvedTypeConstructorCall | undefined {
  const argList = annotation?.argList();
  if (annotation === undefined || argList === undefined) return undefined;
  return {
    path: annotation.name()?.path() ?? [],
    args: readResolvedArgList(argList, sourceFile),
    span: nodePslSpan(annotation.syntax, sourceFile),
  };
}

function readResolvedArgList(
  argList: AttributeArgListAst | undefined,
  sourceFile: SourceFile,
): readonly ResolvedAttributeArg[] {
  if (argList === undefined) return [];
  const args: ResolvedAttributeArg[] = [];
  for (const arg of argList.args()) {
    const name = arg.name()?.name();
    const expression = arg.value();
    args.push({
      kind: name !== undefined ? 'named' : 'positional',
      ...(name !== undefined ? { name } : {}),
      value: renderExpression(expression),
      ...(expression !== undefined ? { expression } : {}),
      span: nodePslSpan(arg.syntax, sourceFile),
    });
  }
  return args;
}

function attributeName(name: QualifiedNameAst | undefined): string {
  return name?.path().join('.') ?? '';
}

function renderExpression(expression: ExpressionAst | undefined): string {
  if (expression === undefined) return '';
  return printSyntax(expression.syntax).trim();
}

export function nodePslSpan(node: SyntaxNode, sourceFile: SourceFile): PslSpan {
  const start = node.offset;
  const end = start + node.green.textLength;
  return {
    start: offsetToPslPosition(start, sourceFile),
    end: offsetToPslPosition(end, sourceFile),
  };
}

/** Unsupported-top-level-block diagnostics are anchored to the keyword token. */
export function keywordPslSpan(node: SyntaxNode, keyword: string, sourceFile: SourceFile): PslSpan {
  const start = node.offset;
  const end = start + keyword.length;
  return {
    start: offsetToPslPosition(start, sourceFile),
    end: offsetToPslPosition(end, sourceFile),
  };
}

export function rangeToPslSpan(range: Range, sourceFile: SourceFile): PslSpan {
  return {
    start: offsetToPslPosition(sourceFile.offsetAt(range.start), sourceFile),
    end: offsetToPslPosition(sourceFile.offsetAt(range.end), sourceFile),
  };
}

function offsetToPslPosition(offset: number, sourceFile: SourceFile): PslSpan['start'] {
  const position: Position = sourceFile.positionAt(offset);
  return { offset, line: position.line + 1, column: position.character + 1 };
}
