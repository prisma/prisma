import type { BasicBuilder } from './BasicBuilder'
import { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class TupleItem implements BasicBuilder {
  private name: string | undefined
  constructor(readonly type: TypeBuilder) {}

  setName(name: string) {
    this.name = name
    return this
  }

  write(writer: Writer<undefined>): void {
    if (this.name) {
      writer.write(this.name).write(': ')
    }
    writer.write(this.type)
  }
}

export class TupleType extends TypeBuilder {
  readonly items: TupleItem[] = []

  add(item: TypeBuilder | TupleItem) {
    if (item instanceof TypeBuilder) {
      item = new TupleItem(item)
    }
    this.items.push(item)
    return this
  }

  override write(writer: Writer): void {
    writer.write('[').writeJoined(', ', this.items).write(']')
  }
}

export function tupleType() {
  return new TupleType()
}

export function tupleItem(type: TypeBuilder) {
  return new TupleItem(type)
}
