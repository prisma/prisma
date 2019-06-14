import { highlightDatamodel } from '../cli/highlight/highlight'
import chalk from 'chalk'

export const missingGeneratorMessage = `\n${chalk.blue(
  'info',
)} You don't have defined any generator in your ${chalk.bold(
  'datamodel.prisma',
)}, so nothing will be generated. You can define them like this:

${chalk.bold(
  highlightDatamodel(`generator photon {
  provider = "javascript"
  output   = "node_modules/@generated/photon"
}`),
)}`
