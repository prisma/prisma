import type { GeneratorConfig } from '@prisma/generator'

import { PRISMA_CLIENT_JS_PROVIDER } from '../prisma-client-js-provider'
import { parseEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(generators: GeneratorConfig[]): string[] {
  return generators.find((g) => parseEnvValue(g.provider) === PRISMA_CLIENT_JS_PROVIDER)?.previewFeatures || []
}
