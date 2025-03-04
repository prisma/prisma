import { isValidJsIdentifier } from '@prisma/internals'

import type { BasicBuilder } from './BasicBuilder'
import type { DocComment } from './DocComment'
import type { TypeBuilder } from './TypeBuilder'
import type { WellKnownSymbol } from './WellKnownSymbol'
import type { Writer } from './Writer'

export class Property implements BasicBuilder {
  private isOptional = false
  private isReadonly = false
  private docComment?: DocComment

  constructor(private name: string | WellKnownSymbol, private type: TypeBuilder) {}

  optional(): this {
    this.isOptional = true
    return this
  }

  readonly(): this {
    this.isReadonly = true
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
    if (this.isReadonly) {
      writer.write('readonly ')
    }

    if (typeof this.name === 'string') {
      if (isValidJsIdentifier(this.name)) {
        writer.write(this.name)
      } else {
        writer.write('[').write(JSON.stringify(this.name)).write(']')
      }
    } else {
      writer.write('[').write(this.name).write(']')
    }

    if (this.isOptional) {
      writer.write('?')
    }
    writer.write(': ').write(this.type)
  }
}

export function property(name: string | WellKnownSymbol, type: TypeBuilder) {
  return new Property(name, type)
}
