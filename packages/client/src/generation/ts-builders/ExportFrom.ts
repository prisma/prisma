import type { BasicBuilder } from './BasicBuilder'
import type { Writer } from './Writer'

export type ExportFrom = NamespaceExport | BindingsExport | ExportAllFrom

export class NamespaceExport implements BasicBuilder {
  constructor(
    private from: string,
    private namespace: string,
  ) {}

  write(writer: Writer<undefined>): void {
    writer.write(`export * as ${this.namespace} from '${this.from}'`)
  }
}

export class BindingsExport implements BasicBuilder {
  private namedExports: NamedExport[] = []
  constructor(private from: string) {}

  named(namedExport: string | NamedExport) {
    if (typeof namedExport === 'string') {
      namedExport = new NamedExport(namedExport)
    }
    this.namedExports.push(namedExport)
    return this
  }

  write(writer: Writer<undefined>): void {
    writer
      .write('export ')
      .write('{ ')
      .writeJoined(', ', this.namedExports)
      .write(' }')

      .write(` from "${this.from}"`)
  }
}

export class NamedExport implements BasicBuilder {
  private alias: string | undefined
  constructor(readonly name: string) {}

  as(alias: string) {
    this.alias = alias
    return this
  }

  write(writer: Writer): void {
    writer.write(this.name)
    if (this.alias) {
      writer.write(' as ').write(this.alias)
    }
  }
}

export class ExportAllFrom implements BasicBuilder {
  constructor(private from: string) {}

  asNamespace(namespace: string) {
    return new NamespaceExport(this.from, namespace)
  }

  named(binding: string | NamedExport) {
    return new BindingsExport(this.from).named(binding)
  }

  write(writer: Writer): void {
    writer.write(`export * from "${this.from}"`)
  }
}

export function moduleExportFrom(from: string) {
  return new ExportAllFrom(from)
}

export function namedExport(name: string) {
  return new NamedExport(name)
}
