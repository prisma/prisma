import { link } from '@prisma/internals'
import chalk from 'chalk'

export const forbiddenPreviewFeatureWithDataProxyFlagMessage = (previewFeatureName: string) => `
${chalk.green(previewFeatureName)} preview feature is not yet available with ${chalk.green('--data-proxy')}.
Please remove ${chalk.red(previewFeatureName)} from the ${chalk.green('previewFeatures')} in your schema.

More information about Data Proxy: ${link('https://pris.ly/d/data-proxy')}
`
