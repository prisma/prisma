export type Platform =
  | 'native'
  | 'darwin'
  | 'debian-openssl-1.0.x'
  | 'debian-openssl-1.1.x'
  | 'rhel-openssl-1.0.x'
  | 'rhel-openssl-1.1.x'
  | 'linux-musl'
  | 'linux-nixos'
  | 'windows'
  | 'freebsd11'
  | 'freebsd12'
  | 'openbsd'
  | 'netbsd'
  | 'arm'

export const platforms: Array<Platform> = [
  'darwin',
  'debian-openssl-1.0.x',
  'debian-openssl-1.1.x',
  'rhel-openssl-1.0.x',
  'rhel-openssl-1.1.x',
  'linux-musl',
  'linux-nixos',
  'windows',
  'freebsd11',
  'freebsd12',
  'openbsd',
  'netbsd',
  'arm',
]

export function mayBeCompatible(
  platformA: Platform,
  platformB: Platform,
): boolean {
  if (platformA.startsWith('freebsd') || platformB.startsWith('freebsd')) {
    return false
  }
  if (platformA === 'native' || platformB === 'native') {
    return true
  }
  if (platformA === 'darwin' || platformB === 'darwin') {
    return false
  }
  if (platformA === 'windows' || platformB === 'windows') {
    return false
  }

  return true
}
