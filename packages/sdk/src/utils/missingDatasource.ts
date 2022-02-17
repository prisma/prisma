import chalk from 'chalk'

import { highlightDatamodel } from '../highlight/highlight'
import { link } from './link'

export const missingDatasource = `\nYou don't have any ${chalk.bold('datasource')} defined in your ${chalk.bold(
  'schema.prisma',
)}.
You can define a datasource like this:

${chalk.bold(
  highlightDatamodel(`datasource db {
  provider = "postgresql"
  url      = env("DB_URL")
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/prisma-schema')}
`
