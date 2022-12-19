export type Platform =
  | 'native'
  | 'darwin'
  | 'darwin-arm64'
  | 'debian-openssl-1.0.x'
  | 'debian-openssl-1.1.x'
  | 'debian-openssl-3.0.x'
  | 'rhel-openssl-1.0.x'
  | 'rhel-openssl-1.1.x'
  | 'rhel-openssl-3.0.x'
  | 'linux-arm64-openssl-1.1.x'
  | 'linux-arm64-openssl-1.0.x'
  | 'linux-arm64-openssl-3.0.x'
  | 'linux-arm-openssl-1.1.x'
  | 'linux-arm-openssl-1.0.x'
  | 'linux-arm-openssl-3.0.x'
  | 'linux-musl'
  | 'linux-musl-openssl-3.0.x'
  | 'linux-nixos'
  | 'windows'
  | 'freebsd11'
  | 'freebsd12'
  | 'freebsd13'
  | 'openbsd'
  | 'netbsd'
  | 'arm'

export const platforms: Array<Platform> = [
  'darwin',
  'darwin-arm64',
  'debian-openssl-1.0.x',
  'debian-openssl-1.1.x',
  'debian-openssl-3.0.x',
  'rhel-openssl-1.0.x',
  'rhel-openssl-1.1.x',
  'rhel-openssl-3.0.x',
  'linux-arm64-openssl-1.1.x',
  'linux-arm64-openssl-1.0.x',
  'linux-arm64-openssl-3.0.x',
  'linux-arm-openssl-1.1.x',
  'linux-arm-openssl-1.0.x',
  'linux-arm-openssl-3.0.x',
  'linux-musl',
  'linux-musl-openssl-3.0.x',
  'linux-nixos',
  'windows',
  'freebsd11',
  'freebsd12',
  'freebsd13',
  'openbsd',
  'netbsd',
  'arm',
]
