import type { BasicBuilder } from './BasicBuilder'
import type { DocComment } from './DocComment'
import type { GenericParameter } from './GenericParameter'
import type { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class TypeDeclaration<InnerType extends TypeBuilder = TypeBuilder> implements BasicBuilder {
  private genericParameters: GenericParameter[] = []
  private docComment?: DocComment

  constructor(public name: string, readonly type: InnerType) {}

  addGenericParameter(param: GenericParameter): this {
    this.genericParameters.push(param)
    return this
  }

  setName(name: string) {
    this.name = name
    return this
  }

  setDocComment(docComment: DocComment): this {
    this.docComment = docComment
    return this
  }

  write(writer: Writer): void {
    if (this.docComment) {
      writer.write(this.docComment)
    }
    writer.write('type ').write(this.name)
    if (this.genericParameters.length > 0) {
      writer.write('<').writeJoined(', ', this.genericParameters).write('>')
    }
    writer.write(' = ').write(this.type)
  }
}

export function typeDeclaration<InnerType extends TypeBuilder = TypeBuilder>(name: string, type: InnerType) {
  return new TypeDeclaration(name, type)
}
