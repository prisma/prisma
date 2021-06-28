/** This is a wrapper around `require` */
export function load<T>(id: string): T {
  try {
    return require(id) as T
  } catch (e) {
    throw new Error(`Unable to require(\`${id}\`)\n ${e.message}`)
  }
}
