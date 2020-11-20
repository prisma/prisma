export interface Generatable {
  toJS?(): string
  toTS(): string
  toTSWithoutNamespace?(): string
}

export function JS(gen: Generatable): string {
  if (gen.toJS) {
    return gen.toJS()
  }

  return ''
}

export function TS(gen: Generatable): string {
  return gen.toTS()
}

