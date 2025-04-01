import { ValueBuilder } from './ValueBuilder'
import { Writer } from './Writer'

export class NamedValue extends ValueBuilder {
  #name: string

  constructor(name: string) {
    super()
    this.#name = name
  }

  override write(writer: Writer): void {
    writer.write(this.#name)
  }
}

export function namedValue(name: string): NamedValue {
  return new NamedValue(name)
}
