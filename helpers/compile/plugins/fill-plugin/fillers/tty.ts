export function isatty(..._args: unknown[]) {
  return false
}

/**
 * A poor man's shim for the "tty" module
 */
const tty = {
  isatty,
}

export default tty
