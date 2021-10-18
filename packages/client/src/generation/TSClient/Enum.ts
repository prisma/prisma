import indent from 'indent-string'
import type { Generatable } from './Generatable'
import type { DMMF } from '../../runtime/dmmf-types'
import type { ExportCollector } from './helpers'
import { TAB_SIZE } from './constants'

export class Enum implements Generatable {
  constructor(
    protected readonly type: DMMF.SchemaEnum,
    protected readonly useNamespace: boolean,
    protected readonly collector?: ExportCollector,
  ) {
    if (useNamespace) {
      this.collector?.addSymbol(type.name)
    }
  }
  public toJS(): string {
    const { type } = this
    return `exports.${this.useNamespace ? 'Prisma.' : ''}${
      type.name
    } = makeEnum({
${indent(type.values.map((v) => `${v}: '${v}'`).join(',\n'), TAB_SIZE)}
});`
  }
  public toTS(): string {
    const { type } = this

    return `export const ${type.name}: {
${indent(type.values.map((v) => `${v}: '${v}'`).join(',\n'), TAB_SIZE)}
};

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name}]\n`
  }
}
