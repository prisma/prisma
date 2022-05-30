import chalk from 'chalk'

import { link } from '../../../utils/link'

export const forbiddenItxWithDataProxyFlagMessage = `
${chalk.green('interactiveTransactions')} preview feature is not yet available with ${chalk.green('--data-proxy')}.
Please remove ${chalk.red('interactiveTransactions')} from the ${chalk.green('previewFeatures')} in your schema.

More information in our documentation:
${link('https://pris.ly/d/data-proxy')}
`
