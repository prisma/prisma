import { blue, bold, yellow } from 'kleur/colors'

import { highlightDatamodel } from '../highlight/highlight'

export const missingGeneratorMessage = `\n${blue('info')} You don't have any generators defined in your ${bold(
  'schema.prisma',
)}, so nothing will be generated.
You can define them like this:

${bold(
  highlightDatamodel(`generator client {
  provider = "prisma-client-js"
}`),
)}`

export const missingModelMessage = `\n${yellow(bold('warn'))} You don't have any ${bold(
  'models',
)} defined in your ${bold('schema.prisma')}, so nothing will be generated.
`
