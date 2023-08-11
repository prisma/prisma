import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class ArraySpread extends TypeBuilder {
  constructor(private innerType: TypeBuilder) {
    super()
  }
  write(writer: Writer): void {
    writer.write('[...').write(this.innerType).write(']')
  }
}

export function arraySpread(innerType: TypeBuilder) {
  return new ArraySpread(innerType)
}
