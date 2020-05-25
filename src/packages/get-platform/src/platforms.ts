export type Platform =
  | 'native'
  | 'darwin'
  | 'debian-openssl-1.0.x'
  | 'debian-openssl-1.1.x'
  | 'rhel-openssl-1.0.x'
  | 'rhel-openssl-1.1.x'
  | 'linux-musl'
  | 'windows'
  | 'freebsd'
  | 'openbsd'
  | 'netbsd'
  | 'nixos'
  | 'arm'

export const platforms = [
  'darwin',
  'debian-openssl-1.0.x',
  'debian-openssl-1.1.x',
  'rhel-openssl-1.0.x',
  'rhel-openssl-1.1.x',
  'linux-musl',
  'windows',
  'freebsd',
  'openbsd',
  'netbsd',
  'nixos',
  'arm',
]

export function mayBeCompatible(
  platformA: Platform,
  platformB: Platform,
): boolean {
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
