export interface Generatable {
  toJS?(): string | Promise<string>
  toTS(): string | Promise<string>
  toBrowserJS?(): string | Promise<string>
  toTSWithoutNamespace?(): string | Promise<string>
}

export function JS(gen: Generatable): string | Promise<string> {
  if (gen.toJS) {
    return gen.toJS()
  }

  return ''
}
export function BrowserJS(gen: Generatable): string | Promise<string> {
  if (gen.toBrowserJS) {
    return gen.toBrowserJS()
  }
  return ''
}
export function TS(gen: Generatable): string | Promise<string> {
  return gen.toTS()
}
