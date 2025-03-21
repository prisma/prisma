import type * as DMMF from '@prisma/dmmf'

import { getRefAllowedTypeName } from '../utils'
import type { Generable } from './Generable'

export class FieldRefInput implements Generable {
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
