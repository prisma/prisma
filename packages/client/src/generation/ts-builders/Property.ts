import isIdentifier from 'is-identifier'

import { BasicBuilder } from './BasicBuilder'
import { DocComment } from './DocComment'
import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class Property implements BasicBuilder {
  private isOptional = false
  private isReadonly = false
  private docComment?: DocComment

  constructor(private name: string, private type: TypeBuilder) {}

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
    if (isIdentifier(this.name)) {
      writer.write(this.name)
    } else {
      writer.write('[').write(JSON.stringify(this.name)).write(']')
    }
    if (this.isOptional) {
      writer.write('?')
    }
    writer.write(': ').write(this.type)
  }
}

export function property(name: string, type: TypeBuilder) {
  return new Property(name, type)
}
