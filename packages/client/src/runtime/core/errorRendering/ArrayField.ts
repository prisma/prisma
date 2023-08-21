import { ErrorBasicBuilder, ErrorWriter } from './base'
import { Field } from './Field'
import { Value } from './Value'

export class ArrayField implements ErrorBasicBuilder, Field {
  constructor(public value: Value) {}
  write(writer: ErrorWriter): void {
    writer.write(this.value)
  }

  markAsError(): void {
    this.value.markAsError()
  }
}
