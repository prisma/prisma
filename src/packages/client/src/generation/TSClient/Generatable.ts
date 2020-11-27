export interface Generatable {
  toJS?(): string
  toTS(): string
  toBrowserJS?(): string
  toTSWithoutNamespace?(): string
}

export function JS(gen: Generatable): string {
  if (gen.toJS) {
    return gen.toJS()
  }

  return ''
}
export function BrowserJS(gen: Generatable): string {
  if (gen.toBrowserJS) {
    return gen.toBrowserJS()
  } return ''
}
export function TS(gen: Generatable): string {
  return gen.toTS()
}

