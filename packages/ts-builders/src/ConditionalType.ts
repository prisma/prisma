import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class ConditionalType extends TypeBuilder {
  needsParenthesisInUnion = true
  needsParenthesisInIntersection = true

  readonly #checkType: TypeBuilder
  readonly #extendsType: TypeBuilder
  readonly #trueType: TypeBuilder
  readonly #falseType: TypeBuilder

  constructor(checkType: TypeBuilder, extendsType: TypeBuilder, trueType: TypeBuilder, falseType: TypeBuilder) {
    super()
    this.#checkType = checkType
    this.#extendsType = extendsType
    this.#trueType = trueType
    this.#falseType = falseType
  }

  write(writer: Writer): void {
    writer.write(this.#checkType)
    writer.write(' extends ')
    writer.write(this.#extendsType)
    writer.write(' ? ')
    writer.write(this.#trueType)
    writer.write(' : ')
    writer.write(this.#falseType)
  }
}

class ConditionalTypeBuilder {
  check(checkType: TypeBuilder) {
    return new ConditionalTypeBuilderWithCheckType(checkType)
  }
}

class ConditionalTypeBuilderWithCheckType {
  readonly #checkType: TypeBuilder

  constructor(checkType: TypeBuilder) {
    this.#checkType = checkType
  }

  extends(extendsType: TypeBuilder) {
    return new ConditionalTypeBuilderWithExtendsType(this.#checkType, extendsType)
  }
}

class ConditionalTypeBuilderWithExtendsType {
  readonly #checkType: TypeBuilder
  readonly #extendsType: TypeBuilder

  constructor(checkType: TypeBuilder, extendsType: TypeBuilder) {
    this.#checkType = checkType
    this.#extendsType = extendsType
  }

  then(trueType: TypeBuilder) {
    return new ConditionalTypeBuilderWithTrueType(this.#checkType, this.#extendsType, trueType)
  }
}

class ConditionalTypeBuilderWithTrueType {
  readonly #checkType: TypeBuilder
  readonly #extendsType: TypeBuilder
  readonly #trueType: TypeBuilder

  constructor(checkType: TypeBuilder, extendsType: TypeBuilder, trueType: TypeBuilder) {
    this.#checkType = checkType
    this.#extendsType = extendsType
    this.#trueType = trueType
  }

  else(falseType: TypeBuilder) {
    return new ConditionalType(this.#checkType, this.#extendsType, this.#trueType, falseType)
  }
}

export function conditionalType(): ConditionalTypeBuilder {
  return new ConditionalTypeBuilder()
}
