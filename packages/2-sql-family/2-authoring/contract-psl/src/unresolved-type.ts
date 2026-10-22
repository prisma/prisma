import { printTaggedLiteral } from '@internal/framework-components/authoring';
import type { AssembledAuthoringContributions } from '@internal/framework-components/control';
import type { DescribeUnresolvedType } from '@internal/psl-parser';
import { SQL_EXPRESSION_TAG } from '@internal/sql-contract/sql-expression';
import { parseQuotedStringLiteral } from './psl-attribute-parsing';
import { describeRemovedFieldPreset } from './removed-field-presets';

/**
 * The message for a field type the binder cannot find. A call to a field preset Prisma 8 removed names what to write instead. `Unsupported("x")`, the Prisma 6 and Prisma 7 way to keep a column of a type those versions do not know, is named as no Prisma 8 type; any other name keeps the binder's message.
 */
export function describeUnresolvedSqlType(
  contributions: AssembledAuthoringContributions,
): DescribeUnresolvedType {
  return ({ field, written }) => {
    const call = field.typeConstructor;
    if (call === undefined) return undefined;
    if (written !== 'Unsupported') return describeRemovedFieldPreset(call, contributions.type);
    const [argument, ...rest] = call.args;
    const typeName =
      argument?.kind === 'positional' && rest.length === 0
        ? parseQuotedStringLiteral(argument.value)
        : undefined;
    if (typeName === undefined) return undefined;
    return `Unsupported(${JSON.stringify(typeName)}) is not a Prisma 8 type. Write the column's type with a type constructor, or as Raw(${printTaggedLiteral(SQL_EXPRESSION_TAG, typeName)}) when no type constructor names it. If ${JSON.stringify(typeName)} comes from a database extension that has a Prisma 8 pack, add the pack to extensions in prisma.config.ts.`;
  };
}
