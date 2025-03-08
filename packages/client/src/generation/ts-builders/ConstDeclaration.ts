import type { BasicBuilder } from './BasicBuilder'
import type { DocComment } from './DocComment'
import type { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class ConstDeclaration implements BasicBuilder {
  private docComment?: DocComment

  constructor(
    readonly name: string,
    readonly type: TypeBuilder,
  ) {}

  setDocComment(docComment: DocComment): this {
    this.docComment = docComment
    return this
  }

  write(writer: Writer): void {
    if (this.docComment) {
      writer.write(this.docComment)
    }
    writer.write('const ').write(this.name).write(': ').write(this.type)
  }
}

export function constDeclaration(name: string, type: TypeBuilder) {
  return new ConstDeclaration(name, type)
}
