export type BinaryTarget =
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
  | 'linux-musl-arm64-openssl-1.1.x'
  | 'linux-musl-arm64-openssl-3.0.x'
  | 'linux-nixos'
  | 'linux-static-x64'
  | 'linux-static-arm64'
  | 'windows'
  | 'freebsd11'
  | 'freebsd12'
  | 'freebsd13'
  | 'freebsd14'
  | 'freebsd15'
  | 'openbsd'
  | 'netbsd'
  | 'arm'

export const binaryTargets: BinaryTarget[] = [
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
  'linux-musl-arm64-openssl-1.1.x',
  'linux-musl-arm64-openssl-3.0.x',
  'linux-nixos',
  'linux-static-x64',
  'linux-static-arm64',
  'windows',
  'freebsd11',
  'freebsd12',
  'freebsd13',
  'freebsd14',
  'freebsd15',
  'openbsd',
  'netbsd',
  'arm',
]
