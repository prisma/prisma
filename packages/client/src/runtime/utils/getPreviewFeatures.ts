import type { GetPrismaClientConfig } from '../getPrismaClient'

/**
 * Get preview features from the configuration stored in the generated client.
 */
export function getPreviewFeatures(config: Pick<GetPrismaClientConfig, 'generator'>): string[] {
  return config.generator?.previewFeatures ?? []
}
