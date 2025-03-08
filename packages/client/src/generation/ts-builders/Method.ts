import type { BasicBuilder } from './BasicBuilder'
import type { DocComment } from './DocComment'
import type { GenericParameter } from './GenericParameter'
import type { Parameter } from './Parameter'
import { voidType } from './PrimitiveType'
import type { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class Method implements BasicBuilder {
  private docComment?: DocComment
  private returnType: TypeBuilder = voidType
  private parameters: Parameter[] = []
  private genericParameters: GenericParameter[] = []
  constructor(private name: string) {}

  setDocComment(docComment: DocComment): this {
    this.docComment = docComment
    return this
  }

  setReturnType(returnType: TypeBuilder): this {
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
    if (this.docComment) {
      writer.write(this.docComment)
    }

    writer.write(this.name)
    if (this.genericParameters.length > 0) {
      writer.write('<').writeJoined(', ', this.genericParameters).write('>')
    }

    writer.write('(')
    if (this.parameters.length > 0) {
      writer.writeJoined(', ', this.parameters)
    }
    writer.write(')')

    if (this.name !== 'constructor') {
      writer.write(': ').write(this.returnType)
    }
  }
}

export function method(name: string): Method {
  return new Method(name)
}
