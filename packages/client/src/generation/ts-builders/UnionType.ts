import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class UnionType<VariantType extends TypeBuilder = TypeBuilder> extends TypeBuilder {
  needsParenthesisWhenIndexed = true
  readonly variants: VariantType[]

  constructor(firstType: VariantType) {
    super()
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

  mapVariants<NewVariantType extends TypeBuilder>(
    callback: (type: VariantType) => NewVariantType,
  ): UnionType<NewVariantType> {
    return unionType(this.variants.map((v) => callback(v)))
  }
}

export function unionType<VariantType extends TypeBuilder = TypeBuilder>(types: VariantType[] | VariantType) {
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
