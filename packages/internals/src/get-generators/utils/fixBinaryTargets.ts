import type { BinaryTargetsEnvValue } from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
function transformBinaryTargetToEnvValue(binaryTarget: BinaryTarget | string): BinaryTargetsEnvValue {
  return { fromEnvVar: null, value: binaryTarget }
}

export function fixBinaryTargets(
  schemaBinaryTargets: BinaryTargetsEnvValue[],
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  runtimeBinaryTarget: BinaryTarget | string,
): BinaryTargetsEnvValue[] {
  schemaBinaryTargets = schemaBinaryTargets || []

  if (!schemaBinaryTargets.find((object) => object.native === true)) {
    return [transformBinaryTargetToEnvValue('native'), ...schemaBinaryTargets]
  }

  return [...schemaBinaryTargets, transformBinaryTargetToEnvValue(runtimeBinaryTarget)]
}
