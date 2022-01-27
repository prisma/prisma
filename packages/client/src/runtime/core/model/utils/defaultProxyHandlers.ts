const defaultPropertyDescriptor = {
  enumerable: true,
  configurable: true,
  writable: false,
}

export function defaultProxyHandlers(ownKeys: string[]) {
  return {
    getOwnPropertyDescriptor: () => defaultPropertyDescriptor,
    has: (_: never, prop: string) => ownKeys.includes(prop),
    ownKeys: () => ownKeys,
  } as const
}
