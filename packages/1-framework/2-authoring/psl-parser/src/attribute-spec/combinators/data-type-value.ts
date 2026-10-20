import {
  admittedTags,
  type DataTypeSupport,
  describeAdmittedForms,
  tagForm,
} from '@internal/framework-components/authoring';
import type { DataTypeId } from '@internal/framework-components/codec';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { PslDiagnostic } from '../../diagnostic';
import { readDataTypeValue } from '../../read-data-type-value';
import { nodePslSpan } from '../../resolve';
import type { ExpressionAst } from '../../syntax/ast/expressions';
import type { AttributeCtx, DataTypeValueArgType, ParsedTypedValue } from '../types';
import { leafDiagnostic } from './diagnostic';

/** An argument typed by a data type: any literal, admitted by the ADR 254 cast rule. Used as a parameter of an attribute, a block or a `funcCall`, never as a bare arm of `oneOf`. ADR 231, ADR 254, ADR 268. */
export function dataTypeValue(
  dataType: DataTypeId,
  support: DataTypeSupport,
): DataTypeValueArgType<AttributeCtx> {
  const tags = admittedTags(support, dataType);
  const [firstTag] = tags;
  return {
    kind: 'dataTypeValue',
    label:
      firstTag === undefined ? describeAdmittedForms(support, dataType) : tagForm(firstTag).phrase,
    dataType,
    tags,
    documentation: support.entries[dataType]?.documentation ?? '',
    parse: (arg, ctx) => parseDataTypeValue(arg, ctx, dataType, support),
  };
}

function parseDataTypeValue(
  arg: ExpressionAst,
  ctx: AttributeCtx,
  dataType: DataTypeId,
  support: DataTypeSupport,
): Result<ParsedTypedValue, readonly PslDiagnostic[]> {
  const read = readDataTypeValue(arg, dataType, support);
  if (!read.ok) return notOk([leafDiagnostic(ctx, arg, read.failure.message, read.failure.code)]);
  return ok({ value: read.value, span: nodePslSpan(arg.syntax, ctx.sources) });
}
