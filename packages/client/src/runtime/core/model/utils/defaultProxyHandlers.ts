export const defaultPropertyDescriptor = {
  enumerable: true,
  configurable: true,
  writable: true,
}

export function defaultProxyHandlers<T extends object>(ownKeys: (string | symbol)[]) {
  const _ownKeys = new Set(ownKeys)
  return {
    getOwnPropertyDescriptor: () => defaultPropertyDescriptor,
    has: (target: T, prop: string | symbol) => _ownKeys.has(prop),
    set: (target: T, prop: string | symbol, value: any) => {
      return _ownKeys.add(prop) && Reflect.set(target, prop, value)
    },
    ownKeys: () => [..._ownKeys],
  } as const
}
