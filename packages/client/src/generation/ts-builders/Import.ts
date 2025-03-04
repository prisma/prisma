import type { BasicBuilder } from './BasicBuilder'
import type { Writer } from './Writer'

export type Import = NamespaceImport | BindingsImport | ModuleImport

export class NamespaceImport implements BasicBuilder {
  constructor(
    readonly alias: string,
    readonly from: string,
  ) {}
  write(writer: Writer<undefined>): void {
    writer.write('import * as ').write(this.alias).write(` from "${this.from}"`)
  }
}

export class BindingsImport implements BasicBuilder {
  private defaultImport: string | undefined
  private namedImports: NamedImport[] = []
  constructor(readonly from: string) {}

  default(name: string) {
    this.defaultImport = name
    return this
  }

  named(namedImport: string | NamedImport) {
    if (typeof namedImport === 'string') {
      namedImport = new NamedImport(namedImport)
    }
    this.namedImports.push(namedImport)
    return this
  }

  write(writer: Writer): void {
    writer.write('import ')
    if (this.defaultImport) {
      writer.write(this.defaultImport)
      if (this.hasNamedImports()) {
        writer.write(', ')
      }
    }

    if (this.hasNamedImports()) {
      writer.write('{ ').writeJoined(', ', this.namedImports).write(' }')
    }

    writer.write(` from "${this.from}"`)
  }

  private hasNamedImports() {
    return this.namedImports.length > 0
  }
}

export class NamedImport implements BasicBuilder {
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

export class ModuleImport implements BasicBuilder {
  constructor(readonly from: string) {}

  asNamespace(alias: string): NamespaceImport {
    return new NamespaceImport(alias, this.from)
  }

  default(alias: string): BindingsImport {
    return new BindingsImport(this.from).default(alias)
  }

  named(namedImport: string | NamedImport) {
    return new BindingsImport(this.from).named(namedImport)
  }

  write(writer: Writer): void {
    writer.write('import ').write(`"${this.from}"`)
  }
}

export function moduleImport(from: string) {
  return new ModuleImport(from)
}

export function namedImport(name: string) {
  return new NamedImport(name)
}
