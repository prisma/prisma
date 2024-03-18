import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class ExportFrom implements BasicBuilder {
  constructor(private modules: '*' | string[], private from: string) {}

  write(writer: Writer): void {
    if (this.modules === '*') {
      writer.write(`export * from '${this.from}'`)
    } else {
      writer.write(`export { ${this.modules.join(', ')} } from '${this.from}'`)
    }
  }
}

export function moduleExportFrom(modules: '*' | string[], from: string) {
  return new ExportFrom(modules, from)
}
