import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class ArraySpread implements BasicBuilder {
  constructor(private innerType: AnyTypeBuilder) {}
  write(writer: Writer): void {
    writer.write('[...').write(this.innerType).write(']')
  }
}

export function arraySpread(innerType: AnyTypeBuilder) {
  return new ArraySpread(innerType)
}
