const defaultPropertyDescriptor = {
  enumerable: true,
  configurable: true,
  writable: true,
}

export function defaultProxyHandlers(ownKeys: (string | symbol)[]) {
  const _ownKeys = new Set(ownKeys)
  return {
    getOwnPropertyDescriptor: () => defaultPropertyDescriptor,
    has: (target: never, prop: string | symbol) => _ownKeys.has(prop),
    set: (target: never, prop: string | symbol, value: any) => {
      return _ownKeys.add(prop) && Reflect.set(target, prop, value)
    },
    ownKeys: () => [..._ownKeys],
  } as const
}
