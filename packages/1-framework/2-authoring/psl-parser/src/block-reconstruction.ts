import type { AuthoringPslBlockDescriptor } from '@internal/framework-components/authoring';
import type {
  PslBlockParam,
  PslExtensionBlock,
  PslExtensionBlockAttribute,
  PslExtensionBlockParamValue,
  PslSpan,
} from '@internal/framework-components/psl-ast';
import type { ParseDiagnostic } from './parse';
import { nodePslSpan } from './resolve';
import type { SourceFile } from './source-file';
import type { GenericBlockDeclarationAst, KeyValuePairAst } from './syntax/ast/declarations';
import { ArrayLiteralAst, type ExpressionAst } from './syntax/ast/expressions';
import { printSyntax } from './syntax/ast-helpers';

/**
 * Descriptor-free and unknown parameters become `value` stubs so validation can
 * report them via key-set comparison. Duplicate member names are first-wins.
 */
export function reconstructExtensionBlock(
  node: GenericBlockDeclarationAst,
  descriptor: AuthoringPslBlockDescriptor | undefined,
  sourceFile: SourceFile,
  diagnostics: ParseDiagnostic[],
): PslExtensionBlock {
  const keyword = node.keyword()?.text ?? '';
  const blockName = node.name()?.name() ?? '';

  const blockAttributes: PslExtensionBlockAttribute[] = [];
  for (const attribute of node.attributes()) {
    const name = attribute.name()?.path().join('.') ?? '';
    const args = Array.from(attribute.argList()?.args() ?? [], (arg) => {
      const value = arg.value();
      return {
        kind: 'positional' as const,
        value: value === undefined ? '' : printSyntax(value.syntax).trim(),
        span: nodePslSpan(arg.syntax, sourceFile),
      };
    });
    blockAttributes.push({
      name,
      args,
      span: nodePslSpan(attribute.syntax, sourceFile),
    });
  }

  const parameters: Record<string, PslExtensionBlockParamValue> = {};
  for (const entry of node.entries()) {
    const key = entry.key()?.name();
    if (key === undefined) continue;
    const span = nodePslSpan(entry.syntax, sourceFile);
    if (Object.hasOwn(parameters, key)) {
      diagnostics.push({
        code: 'PSL_EXTENSION_DUPLICATE_PARAMETER',
        message: `Duplicate parameter "${key}" in "${keyword}" block "${blockName}"; first occurrence wins`,
        range: {
          start: sourceFile.positionAt(entry.syntax.offset),
          end: sourceFile.positionAt(entry.syntax.offset + entry.syntax.green.textLength),
        },
      });
      continue;
    }
    parameters[key] = reconstructParamValue(
      entry,
      descriptor?.parameters[key],
      span,
      sourceFile,
      diagnostics,
    );
  }

  return {
    kind: descriptor?.discriminator ?? keyword,
    keyword,
    name: blockName,
    parameters,
    blockAttributes,
    span: nodePslSpan(node.syntax, sourceFile),
  };
}

function reconstructParamValue(
  entry: KeyValuePairAst,
  param: PslBlockParam | undefined,
  span: PslSpan,
  sourceFile: SourceFile,
  diagnostics: ParseDiagnostic[],
): PslExtensionBlockParamValue {
  const value = entry.value();
  if (value === undefined) {
    return { kind: 'bare', span };
  }
  return reconstructFromExpression(value, param, span, sourceFile, diagnostics);
}

function reconstructFromExpression(
  value: ExpressionAst,
  param: PslBlockParam | undefined,
  span: PslSpan,
  sourceFile: SourceFile,
  diagnostics?: ParseDiagnostic[],
): PslExtensionBlockParamValue {
  const raw = printSyntax(value.syntax).trim();
  if (param?.kind === 'list') {
    const array = ArrayLiteralAst.cast(value.syntax);
    if (!array) {
      diagnostics?.push({
        code: 'PSL_EXTENSION_INVALID_VALUE',
        message: `List parameter expects an array literal, got ${raw}`,
        range: {
          start: sourceFile.positionAt(value.syntax.offset),
          end: sourceFile.positionAt(value.syntax.offset + value.syntax.green.textLength),
        },
      });
      return { kind: 'value', raw, span };
    }

    const items: PslExtensionBlockParamValue[] = [];
    for (const element of array.elements()) {
      items.push(
        reconstructFromExpression(
          element,
          param.of,
          nodePslSpan(element.syntax, sourceFile),
          sourceFile,
          diagnostics,
        ),
      );
    }
    return { kind: 'list', items, span };
  }
  switch (param?.kind) {
    case 'ref':
      return { kind: 'ref', identifier: raw, span };
    case 'option':
      return { kind: 'option', token: raw, span };
    default:
      return { kind: 'value', raw, span };
  }
}
