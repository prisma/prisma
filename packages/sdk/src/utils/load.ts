import fs from 'fs'

/**
 * This is a wrapper around `require`
 * This is to avoid eval and hide require away from bundlers
 */
export function load<T>(id: string): T {
  try {
    return require(id) as T
  } catch (e) {
    const { size } = fs.statSync(id)

    console.log('BINARY_SIZE', size)
    throw new Error(`Unable to require(\`${id}\`)\n ${e.message}`)
  }
}
