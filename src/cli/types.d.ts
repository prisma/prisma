/**
 * Command interface
 */
export interface Command {
  parse(argv: string[]): Promise<string | Error>
}

/**
 * Commands
 */
export type Commands = { [command: string]: Command }
