import { MappedTypeNode } from 'typescript'

import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class UnionType<VariantType extends AnyTypeBuilder = AnyTypeBuilder> implements BasicBuilder {
  readonly variants: VariantType[]

  constructor(firstType: VariantType) {
    this.variants = [firstType]
  }

  addVariant(variant: VariantType) {
    this.variants.push(variant)
    return this
  }

  addVariants(variants: VariantType[]) {
    for (const variant of variants) {
      this.addVariant(variant)
    }
    return this
  }

  write(writer: Writer): void {
    writer.writeJoined(' | ', this.variants)
  }

  mapVariants<NewVariantType extends AnyTypeBuilder>(
    callback: (type: VariantType) => NewVariantType,
  ): UnionType<NewVariantType> {
    return unionType(this.variants.map((v) => callback(v)))
  }
}

export function unionType<VariantType extends AnyTypeBuilder = AnyTypeBuilder>(types: VariantType[] | VariantType) {
  if (Array.isArray(types)) {
    if (types.length === 0) {
      throw new TypeError('Union types array can not be empty')
    }
    const union = new UnionType(types[0])
    for (let i = 1; i < types.length; i++) {
      union.addVariant(types[i])
    }
    return union
  }
  return new UnionType(types)
}
