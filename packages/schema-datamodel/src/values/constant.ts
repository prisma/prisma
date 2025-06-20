/**
 * A unquoted identifier. Should be used if a value has certain naming standards.
 * Equivalent to Rust's Constant<T> type.
 */
export class Constant {
  constructor(private readonly value: string | number | boolean) {}

  public toString(): string {
    return String(this.value)
  }

  public static create(value: string | number | boolean): Constant {
    return new Constant(value)
  }

  public getValue(): string | number | boolean {
    return this.value
  }
}