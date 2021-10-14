export function existsSync() {
  return false
}

/**
 * A stub for fs for tryLoadEnv not to attempt loading .env
 */
const fs = {
  existsSync() {
    return false
  },
}

export default fs
