import fs from 'fs'

/**
 * This is a wrapper around `require`
 * This is to avoid eval and hide require away from bundlers
 */
export function load<T>(id: string): T {
  const { size } = fs.statSync(id)

  console.log('BINARY_SIZE', size)
  try {
    return require(id) as T
  } catch (e) {
    throw new Error(`Unable to require(\`${id}\`)\n ${e.message}`)
  }
}
