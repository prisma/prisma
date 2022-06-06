export interface Generatable {
  toJS?(edge?: boolean): string | Promise<string>
  toTS(edge?: boolean): string | Promise<string>
  toBrowserJS?(): string | Promise<string>
  toTSWithoutNamespace?(): string | Promise<string>
}

export function JS(gen: Generatable, edge = false): string | Promise<string> {
  return gen.toJS?.(edge) ?? ''
}

export function BrowserJS(gen: Generatable): string | Promise<string> {
  return gen.toBrowserJS?.() ?? ''
}

export function TS(gen: Generatable, edge = false): string | Promise<string> {
  return gen.toTS(edge)
}
