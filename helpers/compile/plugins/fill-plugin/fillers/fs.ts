export function existsSync() {
  return false
}

export function readFileSync() {
  return ''
}

/**
 * A stub for fs for tryLoadEnv not to attempt loading .env
 */
const fs = {
  existsSync,
  readFileSync,
}

export default fs
