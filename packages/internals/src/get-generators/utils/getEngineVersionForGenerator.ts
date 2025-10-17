import type { GeneratorManifest } from '@prisma/generator'

export function getEngineVersionForGenerator(
  manifest?: GeneratorManifest,
  defaultVersion?: string | undefined,
): string {
  return defaultVersion ?? 'latest'
}
