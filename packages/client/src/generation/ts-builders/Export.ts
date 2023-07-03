import { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import { BasicBuilder } from './BasicBuilder'
import { DocComment } from './DocComment'
import { Writer } from './Writer'

export class Export implements BasicBuilder {
  private docComment?: DocComment
  constructor(private declaration: AnyDeclarationBuilder) {}

  setDocComment(docComment: DocComment): this {
    this.docComment = docComment
    return this
  }

  write(writer: Writer): void {
    if (this.docComment) {
      writer.write(this.docComment)
    }
    writer.write('export ').write(this.declaration)
  }
}

export function moduleExport(declaration: AnyDeclarationBuilder) {
  return new Export(declaration)
}
