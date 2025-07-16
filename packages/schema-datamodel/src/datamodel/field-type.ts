/**
 * The kind of field type - required, optional, array, or unsupported variants.
 */
type FieldKind =
  | { type: 'required'; typeName: string }
  | { type: 'optional'; typeName: string }
  | { type: 'array'; typeName: string }
  | { type: 'requiredUnsupported'; typeName: string }
  | { type: 'optionalUnsupported'; typeName: string }
  | { type: 'arrayUnsupported'; typeName: string }

/**
 * A type of a field in the datamodel.
 * Equivalent to Rust's FieldType<'a> struct.
 */
export class FieldType {
  constructor(private inner: FieldKind) {}

  /**
   * The field is required, rendered with only the name of the
   * type. For example: `Int`.
   */
  public static required(name: string): FieldType {
    return new FieldType({ type: 'required', typeName: name })
  }

  /**
   * Convert the field type to optional.
   */
  public intoOptional(): this {
    switch (this.inner.type) {
      case 'required':
      case 'array':
        this.inner = { type: 'optional', typeName: this.inner.typeName }
        break
      case 'requiredUnsupported':
      case 'arrayUnsupported':
        this.inner = { type: 'optionalUnsupported', typeName: this.inner.typeName }
        break
      case 'optional':
      case 'optionalUnsupported':
        // Already optional, no change
        break
    }
    return this
  }

  /**
   * Convert the field type to array.
   */
  public intoArray(): this {
    switch (this.inner.type) {
      case 'required':
      case 'optional':
        this.inner = { type: 'array', typeName: this.inner.typeName }
        break
      case 'requiredUnsupported':
      case 'optionalUnsupported':
        this.inner = { type: 'arrayUnsupported', typeName: this.inner.typeName }
        break
      case 'array':
      case 'arrayUnsupported':
        // Already array, no change
        break
    }
    return this
  }

  /**
   * Set the field type to be unsupported by Prisma.
   */
  public intoUnsupported(): this {
    switch (this.inner.type) {
      case 'required':
        this.inner = { type: 'requiredUnsupported', typeName: this.inner.typeName }
        break
      case 'optional':
        this.inner = { type: 'optionalUnsupported', typeName: this.inner.typeName }
        break
      case 'array':
        this.inner = { type: 'arrayUnsupported', typeName: this.inner.typeName }
        break
      // Already unsupported variants, no change needed
    }
    return this
  }

  public toString(): string {
    switch (this.inner.type) {
      case 'required':
        return this.inner.typeName
      case 'optional':
        return `${this.inner.typeName}?`
      case 'array':
        return `${this.inner.typeName}[]`
      case 'requiredUnsupported':
        return `Unsupported("${this.inner.typeName}")`
      case 'optionalUnsupported':
        return `Unsupported("${this.inner.typeName}")?`
      case 'arrayUnsupported':
        return `Unsupported("${this.inner.typeName}")[]`
    }
  }

  public getType(): FieldKind['type'] {
    return this.inner.type
  }

  public getTypeName(): string {
    return this.inner.typeName
  }

  public isOptional(): boolean {
    return this.inner.type === 'optional' || this.inner.type === 'optionalUnsupported'
  }

  public isArray(): boolean {
    return this.inner.type === 'array' || this.inner.type === 'arrayUnsupported'
  }

  public isUnsupported(): boolean {
    return this.inner.type.includes('Unsupported')
  }

  public isRequired(): boolean {
    return this.inner.type === 'required' || this.inner.type === 'requiredUnsupported'
  }
}
