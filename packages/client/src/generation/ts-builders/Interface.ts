import type { GenericParameter } from './GenericParameter'
import type { Method } from './Method'
import type { NamedType } from './NamedType'
import type { Property } from './Property'
import { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

type InterfaceItem = Method | Property

export class InterfaceDeclaration extends TypeBuilder {
  needsParenthesisWhenIndexed = true

  private items: InterfaceItem[] = []
  private genericParameters: GenericParameter[] = []
  private extendedTypes: NamedType[] = []

  constructor(readonly name: string) {
    super()
  }

  add(item: InterfaceItem): this {
    this.items.push(item)
    return this
  }

  addMultiple(items: InterfaceItem[]): this {
    for (const item of items) {
      this.add(item)
    }
    return this
  }

  addGenericParameter(param: GenericParameter) {
    this.genericParameters.push(param)
    return this
  }

  extends(type: NamedType) {
    this.extendedTypes.push(type)
    return this
  }

  write(writer: Writer): void {
    writer.write('interface ').write(this.name)
    if (this.genericParameters.length > 0) {
      writer.write('<').writeJoined(', ', this.genericParameters).write('>')
    }

    if (this.extendedTypes.length > 0) {
      writer.write(' extends ').writeJoined(', ', this.extendedTypes)
    }
    if (this.items.length === 0) {
      writer.writeLine(' {}')
      return
    }

    writer
      .writeLine(' {')
      .withIndent(() => {
        for (const item of this.items) {
          writer.writeLine(item)
        }
      })
      .write('}')
  }
}

export function interfaceDeclaration(name: string) {
  return new InterfaceDeclaration(name)
}
