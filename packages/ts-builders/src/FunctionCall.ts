import { BasicBuilder } from './BasicBuilder'
import { ValueBuilder } from './ValueBuilder'
import { Writer } from './Writer'

export class FunctionCall extends ValueBuilder {
  #name: string
  #args: (string | BasicBuilder)[]

  constructor(name: string, args: (string | BasicBuilder)[]) {
    super()
    this.#name = name
    this.#args = args
  }

  addArgument(arg: string | BasicBuilder): this {
    this.#args.push(arg)
    return this
  }

  override write(writer: Writer): void {
    writer.write(this.#name).write('(').writeJoined(', ', this.#args).write(')')
  }
}

export function functionCall(name: string, args: (string | BasicBuilder)[] = []): FunctionCall {
  return new FunctionCall(name, args)
}
