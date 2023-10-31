import { BinaryTargetsEnvValue } from '@prisma/generator-helper'
import { Platform } from '@prisma/get-platform'

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
function transformPlatformToEnvValue(platform: Platform | string): BinaryTargetsEnvValue {
  return { fromEnvVar: null, value: platform }
}

export function fixBinaryTargets(
  binaryTargets: BinaryTargetsEnvValue[],
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  platform: Platform | string,
): BinaryTargetsEnvValue[] {
  binaryTargets = binaryTargets || []

  if (!binaryTargets.find((object) => object.native === true)) {
    return [transformPlatformToEnvValue('native'), ...binaryTargets]
  }

  return [...binaryTargets, transformPlatformToEnvValue(platform)]
}
