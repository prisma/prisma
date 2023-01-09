import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class Parameter implements BasicBuilder {
  private isOptional = false
  constructor(private name: string, private type: AnyTypeBuilder) {}

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

export function parameter(name: string, type: AnyTypeBuilder) {
  return new Parameter(name, type)
}
