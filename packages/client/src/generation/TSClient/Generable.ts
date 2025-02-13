export interface Generable {
  toJS?(): string
  toTS(): string
  toBrowserJS?(): string
  toTSWithoutNamespace?(): string
}

export function JS(gen: Generable): string {
  return gen.toJS?.() ?? ''
}

export function BrowserJS(gen: Generable): string {
  return gen.toBrowserJS?.() ?? ''
}

export function TS(gen: Generable): string {
  return gen.toTS()
}
