import {
  admittedTags,
  type DataTypeSupport,
  describeAdmittedForms,
  tagForm,
} from '@internal/framework-components/authoring';
import type { DataTypeId } from '@internal/framework-components/codec';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { PslDiagnostic } from '../../diagnostic';
import { readExpressionAs } from '../../read-expression-as';
import { nodePslSpan } from '../../resolve';
import type { ExpressionAst } from '../../syntax/ast/expressions';
import type { AttributeCtx, DataTypeValueArgType, ParsedTypedValue } from '../types';
import { leafDiagnostic } from './diagnostic';

/** An argument typed by a data type: any literal, admitted by the ADR 254 cast rule. Used as a parameter of an attribute, a block or a `funcCall`; `oneOf` refuses it as an arm. ADR 231, ADR 254, ADR 268. */
export function dataTypeValue(
  dataType: DataTypeId,
  support: DataTypeSupport,
  options: {
    /** Written values offered for completion besides the tags. */
    readonly suggestions?: readonly string[];
    /** The label shown for the argument in place of the forms its type admits, such as the values a function takes. */
    readonly label?: string;
  } = {},
): DataTypeValueArgType<AttributeCtx> {
  const tags = admittedTags(support, dataType);
  const [firstTag] = tags;
  return {
    kind: 'dataTypeValue',
    label:
      options.label ??
      (firstTag === undefined
        ? describeAdmittedForms(support, dataType)
        : tagForm(firstTag).phrase),
    dataType,
    tags,
    documentation: support.entries[dataType]?.documentation ?? '',
    suggestions: options.suggestions ?? [],
    parse: (arg, ctx) => parseDataTypeValue(arg, ctx, dataType, support),
  };
}

function parseDataTypeValue(
  arg: ExpressionAst,
  ctx: AttributeCtx,
  dataType: DataTypeId,
  support: DataTypeSupport,
): Result<ParsedTypedValue, readonly PslDiagnostic[]> {
  const read = readExpressionAs(support, dataType, arg);
  if (!read.ok) return notOk([leafDiagnostic(ctx, arg, read.failure.message, read.failure.code)]);
  return ok({ value: read.value, span: nodePslSpan(arg.syntax, ctx.sources) });
}
