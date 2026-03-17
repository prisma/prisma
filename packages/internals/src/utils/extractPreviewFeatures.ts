import type { GeneratorConfig } from '@prisma/generator'

import { BuiltInProvider } from '../prisma-client-js-provider'
import { parseEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(generators: GeneratorConfig[]): string[] {
  return generators.find((g) => parseEnvValue(g.provider) === BuiltInProvider.PrismaClientJs)?.previewFeatures || []
}
