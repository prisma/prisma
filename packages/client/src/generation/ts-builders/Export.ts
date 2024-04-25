import { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import { BasicBuilder } from './BasicBuilder'
import { DocComment } from './DocComment'
import { Writer } from './Writer'

export class Export<Decl extends AnyDeclarationBuilder> implements BasicBuilder {
  private docComment?: DocComment
  constructor(public readonly declaration: Decl) {}

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

export function moduleExport<Decl extends AnyDeclarationBuilder>(declaration: Decl): Export<Decl> {
  return new Export(declaration)
}
