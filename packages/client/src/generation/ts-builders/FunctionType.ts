import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { GenericParameter } from './GenericParameter'
import { Parameter } from './Parameter'
import { voidType } from './PrimitiveType'
import { Writer } from './Writer'

export class FunctionType implements BasicBuilder {
  private returnType: AnyTypeBuilder = voidType
  private parameters: Parameter[] = []
  private genericParameters: GenericParameter[] = []

  setReturnType(returnType: AnyTypeBuilder): this {
    this.returnType = returnType
    return this
  }

  addParameter(param: Parameter): this {
    this.parameters.push(param)
    return this
  }

  addGenericParameter(param: GenericParameter): this {
    this.genericParameters.push(param)
    return this
  }

  write(writer: Writer): void {
    if (this.genericParameters.length > 0) {
      writer.write('<').writeJoined(', ', this.genericParameters).write('>')
    }
    writer.write('(').writeJoined(', ', this.parameters).write(') => ').write(this.returnType)
  }
}

export function functionType(): FunctionType {
  return new FunctionType()
}
