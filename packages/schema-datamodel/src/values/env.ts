/**
 * A value that can be read from the environment.
 * Equivalent to Rust's Env<'a> type.
 */
export class Env {
  constructor(private readonly variableName: string) {}

  public toString(): string {
    return `env("${this.variableName}")`
  }

  public static variable(name: string): Env {
    return new Env(name)
  }

  public static value(value: string): Env {
    // For static values, we just return an env that renders the value directly
    return new (class extends Env {
      toString(): string {
        return `"${value}"`
      }
    })(value)
  }

  public getVariableName(): string {
    return this.variableName
  }
}
