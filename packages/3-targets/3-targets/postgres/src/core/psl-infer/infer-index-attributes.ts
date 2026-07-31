import type {
  PslAttributeArgument,
  PslModelAttribute,
} from '@prisma-next/framework-components/psl-ast';
import { computeIndexContentHash, parseWireName } from '@prisma-next/sql-schema-ir/naming';
import type { SqlIndexIR } from '@prisma-next/sql-schema-ir/types';
import { assertDefined } from '@prisma-next/utils/assertions';
import { buildAttribute, escapePslString, namedArg, positionalArg } from './psl-literals';

export function buildModelConstraintAttribute(
  name: 'id' | 'unique',
  fields: readonly string[],
  constraintName?: string,
): PslModelAttribute {
  const args: PslAttributeArgument[] = [positionalArg(`[${fields.join(', ')}]`)];
  if (constraintName !== undefined) {
    args.push(namedArg('map', `"${escapePslString(constraintName)}"`));
  }
  return buildAttribute('model', name, args);
}

/**
 * Emits one `@@index` attribute at full fidelity. The index's identity is
 * re-detected rather than trusted: `name:` is emitted only when the live name
 * parses as a wire name AND that hash recomputes from the introspected
 * content; otherwise the live name is adopted verbatim with `map:`.
 */
export function buildIndexAttribute(
  index: SqlIndexIR,
  fieldNames: readonly string[] | undefined,
): PslModelAttribute {
  const args: PslAttributeArgument[] = [];
  if (fieldNames !== undefined) {
    args.push(positionalArg(`[${fieldNames.join(', ')}]`));
  } else {
    assertDefined(
      index.expression,
      `buildIndexAttribute: index "${index.name}" carries neither columns nor expression; SqlIndexIR enforces exactly one`,
    );
    args.push(namedArg('expression', `"${escapePslString(index.expression)}"`));
  }

  const parsed = parseWireName(index.name);
  const recomputed = computeIndexContentHash({
    ...(index.columns !== undefined ? { columns: index.columns } : {}),
    ...(index.expression !== undefined ? { expression: index.expression } : {}),
    ...(index.where !== undefined ? { where: index.where } : {}),
    unique: index.unique,
    ...(index.type !== undefined ? { type: index.type } : {}),
    ...(index.options !== undefined ? { options: index.options } : {}),
  });
  if (parsed !== undefined && parsed.hash === recomputed) {
    args.push(namedArg('name', `"${escapePslString(parsed.prefix)}"`));
  } else {
    args.push(namedArg('map', `"${escapePslString(index.name)}"`));
  }

  if (index.where !== undefined) {
    args.push(namedArg('where', `"${escapePslString(index.where)}"`));
  }
  if (index.unique) {
    args.push(namedArg('unique', 'true'));
  }
  const hasOptions = index.options !== undefined && Object.keys(index.options).length > 0;
  if (index.type !== undefined || hasOptions) {
    args.push(namedArg('type', `"${escapePslString(index.type ?? 'btree')}"`));
  }
  if (hasOptions) {
    const entries = Object.entries(index.options ?? {})
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}: "${escapePslString(String(value))}"`);
    args.push(namedArg('options', `{ ${entries.join(', ')} }`));
  }
  return buildAttribute('model', 'index', args);
}
