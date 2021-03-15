export type Platform =
  | 'native'
  | 'darwin'
  | 'debian-openssl-1.0.x'
  | 'debian-openssl-1.1.x'
  | 'rhel-openssl-1.0.x'
  | 'rhel-openssl-1.1.x'
  | 'linux-arm-openssl-1.1.x'
  | 'linux-arm-openssl-1.0.x'
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
  'linux-arm-openssl-1.1.x',
  'linux-arm-openssl-1.0.x',
  'linux-musl',
  'linux-nixos',
  'windows',
  'freebsd11',
  'freebsd12',
  'openbsd',
  'netbsd',
  'arm',
]
