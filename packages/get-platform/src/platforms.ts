export type Platform =
  | 'native'
  | 'darwin'
  | 'linux-glibc-libssl1.0.1'
  | 'linux-glibc-libssl1.0.2'
  | 'linux-glibc-libssl1.0.2-ubuntu1604'
  | 'linux-glibc-libssl1.1.0'
  | 'windows'

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
