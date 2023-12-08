export function isatty() {
  return false
}

/**
 * A stub for fs for tty
 */
const fs = {
  isatty,
}

export default fs
