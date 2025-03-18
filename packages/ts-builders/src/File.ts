import { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Export } from './Export'
import { ExportFrom } from './ExportFrom'
import { Import } from './Import'
import { Writer } from './Writer'

export type FileItem = AnyDeclarationBuilder | Export<any> | ExportFrom
export class File implements BasicBuilder {
  private imports: Import[] = []
  private declarations: FileItem[] = []

  addImport(moduleImport: Import) {
    this.imports.push(moduleImport)
    return this
  }
  add(declaration: FileItem) {
    this.declarations.push(declaration)
  }

  write(writer: Writer<undefined>): void {
    for (const moduleImport of this.imports) {
      writer.writeLine(moduleImport)
    }
    if (this.imports.length > 0) {
      writer.newLine()
    }
    for (const [i, declaration] of this.declarations.entries()) {
      writer.writeLine(declaration)
      if (i < this.declarations.length - 1) {
        writer.newLine()
      }
    }
  }
}

export function file(): File {
  return new File()
}
