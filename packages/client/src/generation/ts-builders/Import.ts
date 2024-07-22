import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class Import implements BasicBuilder {
  constructor(private modules: string[], private from: string) {}

  write(writer: Writer): void {
    writer.write(`import { ${this.modules.join(', ')} } from '${this.from}'`)
  }
}

export function moduleImport(modules: string[], from: string) {
  return new Import(modules, from)
}
