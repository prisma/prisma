export function existsSync() {
  return false
}

const fs = {
  existsSync() {
    return false
  },
}

export default fs
