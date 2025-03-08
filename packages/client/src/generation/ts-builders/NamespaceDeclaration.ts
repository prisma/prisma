import type { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import type { BasicBuilder } from './BasicBuilder'
import type { Export } from './Export'
import type { Writer } from './Writer'

export type NamespaceItem = AnyDeclarationBuilder | Export<AnyDeclarationBuilder>
export class NamespaceDeclaration implements BasicBuilder {
  private items: NamespaceItem[] = []
  constructor(readonly name: string) {}

  add(declaration: NamespaceItem) {
    this.items.push(declaration)
  }

  write(writer: Writer<undefined>): void {
    writer
      .writeLine(`namespace ${this.name} {`)
      .withIndent(() => {
        for (const item of this.items) {
          writer.writeLine(item)
        }
      })
      .write('}')
  }
}

export function namespace(name: string): NamespaceDeclaration {
  return new NamespaceDeclaration(name)
}
