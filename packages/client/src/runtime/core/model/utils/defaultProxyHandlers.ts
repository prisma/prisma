const defaultPropertyDescriptor = {
  enumerable: true,
  configurable: true,
  writable: true,
}

export function defaultProxyHandlers(ownKeys: string[]) {
  return {
    getOwnPropertyDescriptor: () => defaultPropertyDescriptor,
    has: (target: never, prop: string) => ownKeys.includes(prop),
    set: (target: never, prop: string | symbol, value: any) => {
      return Reflect.set(target, prop, value)
    },
    ownKeys: () => ownKeys,
  } as const
}
