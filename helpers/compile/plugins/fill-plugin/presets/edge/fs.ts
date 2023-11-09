export function existsSync() {
  return false
}

export const promises = {}

/**
 * A stub for fs for tryLoadEnv not to attempt loading .env
 */
const fs = {
  existsSync,
  promises,
}

export default fs
