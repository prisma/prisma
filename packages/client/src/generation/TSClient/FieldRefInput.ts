import type { DMMF } from '../../runtime/dmmf-types'
import { getRefAllowedTypeName } from '../utils'
import type { Generatable } from './Generatable'

export class FieldRefInput implements Generatable {
  constructor(private type: DMMF.FieldRefType) {}

  toTS() {
    const allowedTypes = this.getAllowedTypes()
    return `
/**
 * Reference to a field of type ${allowedTypes}
 */
export type ${this.type.name}<$PrismaModel> = FieldRefInputType<$PrismaModel, ${allowedTypes}>
    `
  }

  private getAllowedTypes() {
    return this.type.allowTypes.map(getRefAllowedTypeName).join(' | ')
  }
}
