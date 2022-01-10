import chalk from 'chalk'
import { highlightDatamodel } from '../../../highlight/highlight'
import { link } from '../../../link'

export const forbiddenTransactionsWithProxyFlagMessage = `\nThe ${chalk.green('dataProxy')} and ${chalk.green(
  'interactiveTransactions',
)} Preview Features can not be enabled at the same time.
Remove ${chalk.red('interactiveTransactions')} from previewFeatures, for example:

${chalk.bold(
  highlightDatamodel(`generator client {
    provider = "prisma-client-js"
    previewFeatures = ["dataProxy"]
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/data-proxy')}
`
