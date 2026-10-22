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
import { UNION_LABEL_SEPARATOR } from '../type-label';
import type { AttributeCtx, DataTypeValueArgType, ParsedTypedValue } from '../types';
import { leafDiagnostic } from './diagnostic';

/** How a `dataTypeValue` argument is offered and labelled: its own label, or a label that lists its suggestions. */
export type DataTypeValueOptions =
  | {
      /** Written values offered for completion besides the tags. */
      readonly suggestions?: readonly string[];
      /** The label shown for the argument in place of the forms its type admits. */
      readonly label?: string;
      readonly labelListsSuggestions?: never;
    }
  | {
      readonly suggestions: readonly string[];
      /** The label lists the suggestions as a union's alternatives, as the versions a function takes do. */
      readonly labelListsSuggestions: true;
      readonly label?: never;
    };

/** An argument typed by a data type: any literal, admitted by the ADR 254 cast rule. Used as a parameter of an attribute, a block or a `funcCall`; `oneOf` refuses it as an arm. ADR 231, ADR 254, ADR 268. */
export function dataTypeValue(
  dataType: DataTypeId,
  support: DataTypeSupport,
  options: DataTypeValueOptions = {},
): DataTypeValueArgType<AttributeCtx> {
  const tags = admittedTags(support, dataType);
  const [firstTag] = tags;
  const suggestions = options.suggestions ?? [];
  const labelListsSuggestions = options.labelListsSuggestions === true;
  return {
    kind: 'dataTypeValue',
    label: labelListsSuggestions
      ? suggestions.join(UNION_LABEL_SEPARATOR)
      : (options.label ??
        (firstTag === undefined
          ? describeAdmittedForms(support, dataType)
          : tagForm(firstTag).phrase)),
    labelListsAlternatives: labelListsSuggestions && suggestions.length > 1,
    dataType,
    tags,
    documentation: support.entries[dataType]?.documentation ?? '',
    suggestions,
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
