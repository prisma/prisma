import type { DatabaseCredentials } from '@prisma/internals'

/**
 * match a string that looks like a unix file path
 * implicit relative paths are ignored due to their ambiguity with hostnames
 * (.e.g my-database-socket can both be a hostname and a file path missing the ./ prefix)
 *
 * example 1: an explicit relative path in the same directory
 * ./sockets/my-database-socket
 *
 * example 2: an explicit relative path in a parent directory
 * ../sockets/my-database-socket
 *
 * example 3: an absolute path
 * /sockets/my-database-socket
 *
 * ? for more info: https://regex101.com/r/p9md3l/1
 */
const simpleUnixPathPattern = /^\.{0,2}\//

export function getSocketFromDatabaseCredentials(credentials: DatabaseCredentials): string | null {
  if (['postgres', 'postgresql', 'cockroachdb'].includes(credentials.type)) {
    const host = credentials.host

    if (typeof host === 'string' && simpleUnixPathPattern.test(host)) {
      return host
    }

    return null
  }

  return credentials.socket ?? null
}
