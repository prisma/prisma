import type { BasicBuilder } from './BasicBuilder'
import type { Writer } from './Writer'

export class WellKnownSymbol implements BasicBuilder {
  constructor(readonly name: string) {}
  write(writer: Writer<undefined>): void {
    writer.write('Symbol.').write(this.name)
  }
}

export function wellKnownSymbol(name: string) {
  return new WellKnownSymbol(name)
}

export const toStringTag = wellKnownSymbol('toStringTag')
