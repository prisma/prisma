/**
 * A documentation block on top of an item in the PSL.
 * Equivalent to Rust's Documentation<'a> type.
 */
export class Documentation {
  private lines: string[]

  constructor(content: string) {
    this.lines = content.split('\n')
  }

  /**
   * Add additional documentation lines to the end with a newline.
   */
  public push(newDocs: string): void {
    this.lines.push(...newDocs.split('\n'))
  }

  public toString(): string {
    return (
      this.lines
        .map((line) => {
          if (line.trim() === '') {
            return '///'
          }
          return `/// ${line}`
        })
        .join('\n') + '\n'
    )
  }

  public getContent(): string {
    return this.lines.join('\n')
  }

  public static create(content: string): Documentation {
    return new Documentation(content)
  }
}
