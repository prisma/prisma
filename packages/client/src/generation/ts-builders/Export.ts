import type { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import type { BasicBuilder } from './BasicBuilder'
import type { DocComment } from './DocComment'
import type { Writer } from './Writer'

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
