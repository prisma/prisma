import type { AnyArgType, ArgType, AttributeCtx } from './types';

/** How a union's alternatives are joined in its label. */
export const UNION_LABEL_SEPARATOR = ' | ';

function readsAsUnion(type: AnyArgType | ArgType<unknown, never>): boolean {
  if (type.kind === 'dataTypeValue') return type.labelListsAlternatives;
  if (type.kind !== 'oneOf' || !type.labelListsAlternatives) return false;
  const [only, ...rest] = type.alternatives;
  return rest.length > 0 || readsAsUnion(only);
}

/**
 * A type's label, parenthesized when the label lists a union's alternatives, so a suffix such
 * as `[]` or `?` applies to the whole union.
 */
export function groupedTypeLabel<Ctx extends AttributeCtx>(
  type: ArgType<unknown, Ctx> | ArgType<unknown, never>,
): string {
  return readsAsUnion(type) ? `(${type.label})` : type.label;
}
