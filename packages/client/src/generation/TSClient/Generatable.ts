export interface Generatable {
  toJS?(): string | Promise<string>
  toTS(): string | Promise<string>
  toBrowserJS?(): string | Promise<string>
  toTSWithoutNamespace?(): string | Promise<string>
}

export async function JS(gen: Generatable): Promise<string> {
  if (gen.toJS) {
    return gen.toJS()
  }

  return ''
}
export async function BrowserJS(gen: Generatable): Promise<string> {
  if (gen.toBrowserJS) {
    return gen.toBrowserJS()
  }
  return ''
}
export async function TS(gen: Generatable): Promise<string> {
  return gen.toTS()
}
