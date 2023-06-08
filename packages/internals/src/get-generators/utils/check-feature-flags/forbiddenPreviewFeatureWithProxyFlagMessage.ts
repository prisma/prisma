import { green, red } from 'kleur/colors'

import { link } from '../../../utils/link'

export const forbiddenPreviewFeatureWithDataProxyFlagMessage = (previewFeatureName: string) => `
${green(previewFeatureName)} preview feature is not yet available with ${green('--data-proxy')}.
Please remove ${red(previewFeatureName)} from the ${green('previewFeatures')} in your schema.

More information about Data Proxy: ${link('https://pris.ly/d/data-proxy')}
`
