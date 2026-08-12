import type { ArgType, OptionalArgType } from './types';

export function optional<T>(type: ArgType<T>, ...rest: [defaultValue: T] | []): OptionalArgType<T> {
  if (rest.length === 0) {
    return { ...type, optional: true, hasDefault: false };
  }
  return { ...type, optional: true, hasDefault: true, defaultValue: rest[0] };
}
