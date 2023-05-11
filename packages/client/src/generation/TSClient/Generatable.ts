export interface Generatable {
  toTS(): string | Promise<string>
  toJS?(): string | Promise<string>
  toBrowserJS?(): string | Promise<string>
  toTSWithoutNamespace?(): string | Promise<string>
}
