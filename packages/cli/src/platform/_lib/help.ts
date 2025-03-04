import { format, HelpError } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

interface HelpContent {
  command?: string
  subcommand?: string
  subcommands?: string[][]
  options?: string[][]
  examples?: string[]
  additionalContent?: string[]
}

export const createHelp = (content: HelpContent) => {
  const { command, subcommand, subcommands, options, examples, additionalContent } = content
  const command_ = subcommand
    ? `prisma platform ${command} ${subcommand}`
    : command && subcommands
      ? `prisma platform ${command} [command]`
      : 'prisma platform [command]'

  const usage = format(`
${bold('Usage')}

  ${dim('$')} ${command_} [options]
`)

  // prettier-ignore
  const commands =
    subcommands &&
    format(`
${bold('Commands')}

${subcommands.map(([option, description]) => `${option.padStart(15)}   ${description}`).join('\n')}
  `)

  // prettier-ignore
  const options_ =
    options &&
    format(`
${bold('Options')}

${options.map(([option, alias, description]) => `  ${option.padStart(15)} ${alias && `${alias},`}   ${description}`).join('\n')}
  `)

  // prettier-ignore
  const examples_ =
    examples &&
    format(`
${bold('Examples')}

${examples.map((example) => `  ${dim('$')} ${example}`).join('\n')}
  `)

  // prettier-ignore
  const additionalContent_ =
    additionalContent &&
    format(`
${additionalContent.map((entry) => `${entry}`).join('\n')}
  `)

  const help = [usage, commands, options_, examples_, additionalContent_].filter(Boolean).join('')
  return (error?: string) => (error ? new HelpError(`\n${bold(red('!'))} ${error}\n${help}`) : help)
}
