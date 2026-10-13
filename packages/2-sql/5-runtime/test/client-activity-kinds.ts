declare module '@internal/framework-components/runtime' {
  interface ClientActivityKinds {
    'test-call': { result: ReadonlyArray<{ readonly id: number }> };
  }
}

export const testCall = { kind: 'test-call', contentHash: 'call-hash' } as const;
