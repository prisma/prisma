import type {
  ArgType,
  AttributeSpec,
  InspectableArgType,
  Param,
  PositionalParam,
} from '@internal/psl-parser';
import {
  ArrayLiteralAst,
  type AttributeArgAst,
  type AttributeArgListAst,
  type ExpressionAst,
  FunctionCallAst,
  IdentifierAst,
  ObjectLiteralExprAst,
  type SourceFile,
  type SyntaxNode,
  type SyntaxToken,
  skipTriviaToken,
} from '@internal/psl-parser/syntax';
import { blindCast } from '@internal/utils/casts';
import { type CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import type { AttributeArgumentCompletionContext } from './completion-context';
import { requiredArgumentsSnippet } from './completion-snippets';

interface CompletionInput {
  readonly context: AttributeArgumentCompletionContext;
  readonly sourceFile: SourceFile;
  readonly clientSupportsSnippets: boolean;
}

interface ArgumentSignature {
  readonly positional?: readonly PositionalParam<unknown, never>[];
  readonly named?: Readonly<Record<string, Param<unknown, never>>>;
}

export function provideAttributeArgumentCompletionItems(
  input: CompletionInput,
  spec: AttributeSpec<never, never>,
): readonly CompletionItem[] {
  const args = input.context.attribute.argList();
  if (args === undefined) return [];
  return deduplicate(completeArguments(input, args, spec)).map((item, index) => ({
    ...item,
    sortText: index.toString().padStart(4, '0'),
  }));
}

function directArgType(param: ArgType<unknown, never>): InspectableArgType<never> {
  return blindCast<
    InspectableArgType<never>,
    'Completion inspects registry combinators whose constructors retain kind-specific metadata; public ArgType erases that metadata, and completion never invokes parse.'
  >(param);
}

function completeArguments(
  input: CompletionInput,
  container: AttributeArgListAst | FunctionCallAst,
  signature: ArgumentSignature,
): readonly CompletionItem[] {
  const { offset } = input.context;
  const opening = container.lparen();
  const closing = container.rparen();
  if (
    opening === undefined ||
    offset <= opening.offset ||
    (closing !== undefined && offset >= closing.endOffset)
  )
    return [];
  let positionalSlot = 0;
  for (const arg of container.args()) {
    if (arg.syntax.offset > offset) break;
    if (containsCursor(arg.syntax, input)) {
      return completeArgument(input, arg, positionalSlot, container, signature);
    }
    if (arg.name() === undefined) positionalSlot += 1;
  }
  if (!followsSeparator(container.syntax, offset, ['LParen', 'Comma'])) return [];
  return [
    ...completeValue(input, signature.positional?.[positionalSlot]?.type, undefined),
    ...completeNamedKeys(input, container, signature),
  ];
}

function completeArgument(
  input: CompletionInput,
  arg: AttributeArgAst,
  positionalSlot: number,
  container: AttributeArgListAst | FunctionCallAst,
  signature: ArgumentSignature,
): readonly CompletionItem[] {
  const colon = arg.colon();
  if (colon !== undefined) {
    if (input.context.offset <= colon.offset) return completeNamedKeys(input, container, signature);
    const name = arg.name()?.name();
    return completeValue(
      input,
      name === undefined ? undefined : signature.named?.[name],
      arg.value(),
    );
  }
  const value = arg.value();
  const values = completeValue(input, signature.positional?.[positionalSlot]?.type, value);
  return value === undefined || value instanceof IdentifierAst
    ? [...values, ...completeNamedKeys(input, container, signature)]
    : values;
}

function completeNamedKeys(
  input: CompletionInput,
  container: AttributeArgListAst | FunctionCallAst,
  signature: ArgumentSignature,
): readonly CompletionItem[] {
  const existing = new Set<string>();
  for (const arg of container.args()) {
    if (arg.syntax.isInside(input.context.offset)) continue;
    const name = arg.name()?.name();
    if (name !== undefined) existing.add(name);
  }
  return Object.keys(signature.named ?? {})
    .filter((name) => !existing.has(name))
    .map((name) => completionItem(input, name, name, CompletionItemKind.Property));
}

function completeValue(
  input: CompletionInput,
  param: Param<unknown, never> | undefined,
  expression: ExpressionAst | undefined,
): readonly CompletionItem[] {
  if (param === undefined) return [];
  const type = directArgType(param);
  switch (type.kind) {
    case 'oneOf':
      return type.alternatives.flatMap((alternative) =>
        completeValue(input, alternative, expression),
      );
    case 'list':
      return completeList(input, type.of, expression);
    case 'record':
      return completeRecord(input, type.of, expression);
    case 'funcCall':
      return completeFunction(input, type, expression);
    case 'identifier':
      return scalarItems(input, expression, [type.name]);
    case 'str':
      return scalarItems(
        input,
        expression,
        type.value === undefined ? [] : [JSON.stringify(type.value)],
      );
    case 'num':
      return scalarItems(input, expression, type.value === undefined ? [] : [String(type.value)]);
    case 'bool':
      return scalarItems(input, expression, ['true', 'false']);
    case 'entityRef':
    case 'fieldRef':
    case 'referencedFieldRef':
    case 'int':
    case 'json':
    case 'rejecting':
      return [];
  }
}

function completeList(
  input: CompletionInput,
  elementType: Param<unknown, never>,
  expression: ExpressionAst | undefined,
): readonly CompletionItem[] {
  if (!(expression instanceof ArrayLiteralAst)) return [];
  const opening = expression.lbracket();
  const closing = expression.rbracket();
  const { offset } = input.context;
  if (
    opening === undefined ||
    offset <= opening.offset ||
    (closing !== undefined && offset >= closing.endOffset)
  )
    return [];
  for (const element of expression.elements()) {
    if (containsCursor(element.syntax, input)) return completeValue(input, elementType, element);
  }
  return followsSeparator(expression.syntax, offset, ['LBracket', 'Comma'])
    ? completeValue(input, elementType, undefined)
    : [];
}

function completeRecord(
  input: CompletionInput,
  valueType: Param<unknown, never>,
  expression: ExpressionAst | undefined,
): readonly CompletionItem[] {
  if (!(expression instanceof ObjectLiteralExprAst)) return [];
  const closing = expression.rbrace();
  const { offset } = input.context;
  if (closing !== undefined && offset >= closing.endOffset) return [];
  for (const field of expression.fields()) {
    const colon = field.colon();
    if (containsCursor(field.syntax, input) && colon !== undefined && offset > colon.offset) {
      return completeValue(input, valueType, field.value());
    }
  }
  return [];
}

function completeFunction(
  input: CompletionInput,
  type: Extract<InspectableArgType<never>, { readonly kind: 'funcCall' }>,
  expression: ExpressionAst | undefined,
): readonly CompletionItem[] {
  if (expression instanceof FunctionCallAst) {
    const opening = expression.lparen();
    if (opening !== undefined && input.context.offset > opening.offset) {
      return expression.name()?.isSimpleName(type.name) === true
        ? completeArguments(input, expression, type.signature)
        : [];
    }
  } else if (expression instanceof ArrayLiteralAst || expression instanceof ObjectLiteralExprAst) {
    return [];
  }
  const useSnippet = input.clientSupportsSnippets && !(expression instanceof FunctionCallAst);
  const text = useSnippet ? `${type.name}(${requiredArgumentsSnippet(type.signature)})` : type.name;
  return [completionItem(input, type.name, text, CompletionItemKind.Function, useSnippet)];
}

function scalarItems(
  input: CompletionInput,
  expression: ExpressionAst | undefined,
  labels: readonly string[],
): readonly CompletionItem[] {
  if (
    expression instanceof ArrayLiteralAst ||
    expression instanceof ObjectLiteralExprAst ||
    expression instanceof FunctionCallAst
  )
    return [];
  return labels.map((label) => completionItem(input, label, label, CompletionItemKind.Value));
}

function completionItem(
  input: CompletionInput,
  label: string,
  newText: string,
  kind: CompletionItemKind,
  snippet = false,
): CompletionItem {
  const { offset, attribute } = input.context;
  const at = attribute.syntax.tokenAtOffset(offset);
  const right = at.rightBiased();
  const token = isValueToken(right) ? right : at.leftBiased();
  const replaceToken = isValueToken(token);
  return {
    label,
    kind,
    detail: kind === CompletionItemKind.Property ? 'Attribute argument' : 'PSL argument value',
    filterText: label,
    textEdit: {
      range: {
        start: input.sourceFile.positionAt(replaceToken ? token.offset : offset),
        end: input.sourceFile.positionAt(replaceToken ? token.endOffset : offset),
      },
      newText,
    },
    ...(snippet ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
  };
}

function isValueToken(token: SyntaxToken | undefined): token is SyntaxToken {
  return (
    token !== undefined &&
    (token.kind === 'Ident' || token.kind === 'StringLiteral' || token.kind === 'NumberLiteral')
  );
}

function containsCursor(node: SyntaxNode, input: CompletionInput): boolean {
  const { offset, attribute } = input.context;
  if (node.isInside(offset)) return true;
  const token = attribute.syntax.tokenAtOffset(offset).leftBiased() ?? attribute.syntax.lastToken;
  const preceding = token === undefined ? undefined : skipTriviaToken(token, 'prev');
  return (
    preceding !== undefined &&
    preceding.endOffset <= offset &&
    preceding.offset >= node.offset &&
    preceding.offset < node.endOffset
  );
}

function followsSeparator(node: SyntaxNode, offset: number, kinds: readonly string[]): boolean {
  const token = node.tokenAtOffset(offset).leftBiased() ?? node.lastToken;
  return token !== undefined && kinds.includes(skipTriviaToken(token, 'prev')?.kind ?? '');
}

function deduplicate(items: readonly CompletionItem[]): readonly CompletionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify([item.label, item.textEdit, item.insertTextFormat]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
