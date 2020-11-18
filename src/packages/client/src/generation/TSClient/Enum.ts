import indent from 'indent-string';
import { Generatable } from "./Generatable"
import { DMMF } from '../../runtime/dmmf-types'
import { ExportCollector } from "./helpers"
import { tab } from "./constants"

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
    return `exports.${this.useNamespace ? 'Prisma.' : ''}${type.name} = makeEnum({
${indent(type.values.map((v) => `${v}: '${v}'`).join(',\n'), tab)}
});`
  }
  public toTS(): string {
    const { type } = this

    return `export const ${type.name}: {
${indent(type.values.map((v) => `${v}: '${v}'`).join(',\n'), tab)}
};

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name
      }]\n`
  }
}