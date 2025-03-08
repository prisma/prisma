import type { GetPrismaClientConfig } from '../../getPrismaClient'

type Config = Pick<GetPrismaClientConfig, 'generator'>

/**
 * Get preview features from the configuration stored in the generated client.
 */
export function getPreviewFeatures({ generator }: Config): string[] {
  return generator?.previewFeatures ?? []
}
