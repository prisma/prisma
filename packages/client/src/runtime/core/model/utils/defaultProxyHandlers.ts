export const defaultPropertyDescriptor = {
  enumerable: true,
  configurable: true,
  writable: true,
}

export function defaultProxyHandlers<T extends object>(ownKeys: (string | symbol)[]) {
  const _ownKeys = new Set(ownKeys)
  return {
    getPrototypeOf: () => Object.prototype,
    getOwnPropertyDescriptor: () => defaultPropertyDescriptor,
    has: (_target: T, prop: string | symbol) => _ownKeys.has(prop),
    set: (target: T, prop: string | symbol, value: any) => {
      return _ownKeys.add(prop) && Reflect.set(target, prop, value)
    },
    ownKeys: () => [..._ownKeys],
  } as const
}
