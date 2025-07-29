import { ValueBuilder } from './ValueBuilder'
import { Writer } from './Writer'

export class FunctionCall extends ValueBuilder {
  #name: string
  #args: ValueBuilder[]

  constructor(name: string, args: ValueBuilder[]) {
    super()
    this.#name = name
    this.#args = args
  }

  addArgument(arg: ValueBuilder): this {
    this.#args.push(arg)
    return this
  }

  override write(writer: Writer): void {
    writer.write(this.#name).write('(').writeJoined(', ', this.#args).write(')')
  }
}

export function functionCall(name: string, args: ValueBuilder[] = []): FunctionCall {
  return new FunctionCall(name, args)
}
