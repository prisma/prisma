import { format } from '@prisma/internals'
import { bold, dim } from 'kleur/colors'

interface HelpOptions {
  subcommands: [string, string][]
  examples: string[]
}

/** Generates formatted help text for a platform subcommand group. */
export function createHelp({ subcommands, examples }: HelpOptions): string {
  const maxNameLen = Math.max(...subcommands.map(([name]) => name.length))
  const subcommandLines = subcommands.map(([name, desc]) => `    ${name.padEnd(maxNameLen)}   ${desc}`).join('\n')
  const exampleLines = examples.map((e) => `    ${dim('$')} ${e}`).join('\n')

  return format(`
  Prisma Data Platform commands

  ${bold('Usage')}

    ${dim('$')} prisma platform [command]

  ${bold('Commands')}

${subcommandLines}

  ${bold('Flags')}

    -h, --help   Display this help message

  ${bold('Examples')}

${exampleLines}
`)
}
