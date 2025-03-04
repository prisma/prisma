import type { BasicBuilder } from './BasicBuilder'
import type { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class Parameter implements BasicBuilder {
  private isOptional = false
  constructor(
    private name: string,
    private type: TypeBuilder,
  ) {}

  optional(): this {
    this.isOptional = true
    return this
  }

  write(writer: Writer): void {
    writer.write(this.name)
    if (this.isOptional) {
      writer.write('?')
    }
    writer.write(': ').write(this.type)
  }
}

export function parameter(name: string, type: TypeBuilder) {
  return new Parameter(name, type)
}
