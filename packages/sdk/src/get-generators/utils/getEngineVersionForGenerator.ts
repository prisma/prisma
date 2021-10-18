import type { GeneratorManifest } from '@prisma/generator-helper'

export function getEngineVersionForGenerator(
  manifest?: GeneratorManifest,
  defaultVersion?: string | undefined,
): string {
  let neededVersion = manifest?.requiresEngineVersion

  neededVersion = neededVersion ?? defaultVersion // default to CLI version otherwise, if not provided

  return neededVersion ?? 'latest'
}
