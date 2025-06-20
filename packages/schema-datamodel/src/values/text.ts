/**
 * A quoted text value in the PSL.
 * Equivalent to Rust's Text<T> type.
 */
export class Text {
  constructor(private readonly value: string) {}

  public toString(): string {
    // Escape quotes and special characters
    const escaped = this.value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
    
    return `"${escaped}"`
  }

  public static create(value: string): Text {
    return new Text(value)
  }

  public getValue(): string {
    return this.value
  }
}