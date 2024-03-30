import { BinaryTarget } from '@prisma/get-platform'

export function isNixOsTarget(target: BinaryTarget) {
  return target === 'linux-nixos' || target === 'linux-nixos-arm64'
}

export function getDownloadableBinaryTarget(target: BinaryTarget) {
  const nixosToNormalTargetMap: Partial<Record<BinaryTarget, BinaryTarget>> = {
    'linux-nixos': 'debian-openssl-3.0.x',
    'linux-nixos-arm64': 'linux-arm64-openssl-3.0.x',
  }
  return nixosToNormalTargetMap[target] ?? target
}
