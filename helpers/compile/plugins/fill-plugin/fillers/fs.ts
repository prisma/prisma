export function existsSync() {
  return false
}

export function lstatSync() {
  return {
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date(),
  }
}

export function statSync() {
  return lstatSync()
}

export function readdirSync() {
  return []
}

export function readdir(cb: (err: Error | null, files: string[]) => void) {
  cb(null, [])
}

export function readlinkSync() {
  return ''
}

export function realpathSync() {
  return ''
}

export function chmodSync() {}

export function renameSync() {}

export function mkdirSync() {}

export function rmdirSync() {}

export function rmSync() {}

export function unlinkSync() {}

export function watchFile() {}

export function unwatchFile() {}

export function watch() {
  return {
    close: () => {},
    on: () => {},
    removeAllListeners: () => {},
  }
}

export function stat(path: string, callback: (err: Error | null, stats?: any) => void) {
  callback(null, lstatSync())
}

export const promises = {}

/**
 * A stub for fs for tryLoadEnv not to attempt loading .env
 */
const fs = {
  existsSync,
  lstatSync,
  stat,
  statSync,
  readdirSync,
  readdir,
  readlinkSync,
  realpathSync,
  chmodSync,
  renameSync,
  mkdirSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  watchFile,
  unwatchFile,
  watch,
  promises,
}

export default fs
