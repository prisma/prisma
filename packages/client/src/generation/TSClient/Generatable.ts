// TODO rename this to Generable (correct english term)
export interface Generatable {
  toJS?(): string | Promise<string>
  toTS(): string | Promise<string>
  toBrowserJS?(): string | Promise<string>
  toTSWithoutNamespace?(): string | Promise<string>
}

export function JS(gen: Generatable): string | Promise<string> {
  return gen.toJS?.() ?? ''
}

export function BrowserJS(gen: Generatable): string | Promise<string> {
  return gen.toBrowserJS?.() ?? ''
}

export function TS(gen: Generatable): string | Promise<string> {
  return gen.toTS()
}
