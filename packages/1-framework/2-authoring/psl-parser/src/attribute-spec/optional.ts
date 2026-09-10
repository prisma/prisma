import type { AnyArgType, CtxOf, OptionalArgType, OutOf } from './types';

export function optional<Type extends AnyArgType>(
  type: Type,
): OptionalArgType<OutOf<Type>, CtxOf<Type>, Type, false>;
export function optional<Type extends AnyArgType>(
  type: Type,
  defaultValue: NoInfer<OutOf<Type>>,
): OptionalArgType<OutOf<Type>, CtxOf<Type>, Type, true>;
export function optional<Type extends AnyArgType>(
  type: Type,
  ...rest: [defaultValue: NoInfer<OutOf<Type>>] | []
): OptionalArgType<OutOf<Type>, CtxOf<Type>, Type, boolean> {
  if (rest.length === 0) {
    return { ...type, optional: true, hasDefault: false };
  }
  return { ...type, optional: true, hasDefault: true, defaultValue: rest[0] };
}
