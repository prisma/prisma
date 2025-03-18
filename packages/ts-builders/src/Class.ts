import { GenericParameter } from './GenericParameter'
import { Method } from './Method'
import { NamedType } from './NamedType'
import { Property } from './Property'
import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

type ClassItem = Method | Property

export class ClassDeclaration extends TypeBuilder {
  needsParenthesisWhenIndexed = true

  private items: ClassItem[] = []
  private genericParameters: GenericParameter[] = []
  private extendedTypes: NamedType[] = []

  constructor(readonly name: string) {
    super()
  }

  add(item: ClassItem): this {
    this.items.push(item)
    return this
  }

  addMultiple(items: ClassItem[]): this {
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
    writer.write('class ').write(this.name)
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

export function classDeclaration(name: string) {
  return new ClassDeclaration(name)
}
