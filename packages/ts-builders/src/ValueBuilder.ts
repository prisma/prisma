import { BasicBuilder } from './BasicBuilder'
import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export abstract class ValueBuilder implements BasicBuilder {
  as(type: TypeBuilder): TypeAssertion {
    return new TypeAssertion(this, type)
  }

  abstract write(writer: Writer<undefined>): void
}

// Must be in the same file due to a circular dependency
export class TypeAssertion extends ValueBuilder {
  #value: ValueBuilder
  #type: TypeBuilder

  constructor(value: ValueBuilder, type: TypeBuilder) {
    super()
    this.#value = value
    this.#type = type
  }

  override write(writer: Writer): void {
    writer.write(this.#value).write(' as ').write(this.#type)
  }
}
