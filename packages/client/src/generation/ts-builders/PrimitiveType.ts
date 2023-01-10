import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class PrimitiveType implements BasicBuilder {
  constructor(private name: string) {}

  write(writer: Writer): void {
    writer.write(this.name)
  }
}

export const stringType = new PrimitiveType('string')
export const numberType = new PrimitiveType('number')
export const booleanType = new PrimitiveType('boolean')
export const nullType = new PrimitiveType('null')
export const undefinedType = new PrimitiveType('undefined')
export const bigintType = new PrimitiveType('bigint')
export const unknownType = new PrimitiveType('unknown')
export const anyType = new PrimitiveType('any')
export const voidType = new PrimitiveType('void')
