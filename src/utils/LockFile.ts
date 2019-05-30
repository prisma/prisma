import { LockFile } from '../types'

const header = `# IF THERE'S A GIT CONFLICT IN THIS FILE, DON'T SOLVE IT MANUALLY!
# INSTEAD EXECUTE \`prisma lift fix\`
# lift lockfile v1
# Read more about conflict resolution here: TODO
`

export function deserializeLockFile(file: string): LockFile {
  const lines = file.split('\n').filter(line => {
    const trimmed = line.trim()
    return !trimmed.startsWith('#') && trimmed.length !== 0
  })

  const localMigrations: string[] = []
  const remoteMigrations: string[] = []
  let localBranch: string | undefined = undefined
  let remoteBranch: string | undefined = undefined

  let sawLocalMarker = false
  let sawRemoteMarker = false
  let sawDivider = false
  for (const line of lines) {
    let isMarker = false
    if (line.startsWith('<<<<<<<')) {
      sawLocalMarker = true
      localBranch = line.slice('<<<<<<< '.length)
      isMarker = true
    }
    if (line.startsWith('=======')) {
      sawDivider = true
      isMarker = true
    }
    if (line.startsWith('>>>>>>>')) {
      sawRemoteMarker = true
      remoteBranch = line.slice('>>>>>>> '.length)
      isMarker = true
    }
    if (!isMarker) {
      // if we didn't see any marker yet, remote equals local
      if (!sawLocalMarker && !sawRemoteMarker) {
        localMigrations.push(line)
        remoteMigrations.push(line)
      }
      // if we saw the local marker and not yet the divider,
      // these migrations belong to the local branch
      if (sawLocalMarker && !sawDivider) {
        localMigrations.push(line)
      }
      // if we saw the divider, it's time for the remoteMigrations
      if (sawLocalMarker && sawDivider) {
        remoteMigrations.push(line)
      }
      // this case is fairly unlikely but still CAN happen:
      // if there are a few migrations they have in common at the end
      if (sawLocalMarker && sawDivider && sawRemoteMarker) {
        localMigrations.push(line)
        remoteMigrations.push(line)
      }
    }
  }

  return {
    localMigrations,
    remoteMigrations,
    localBranch,
    remoteBranch,
  }
}

export function serializeLockFile(lockFile: LockFile): string {
  return `${header}\n${lockFile.localMigrations.join('\n')}`
}

export function initLockFile(): LockFile {
  return {
    localMigrations: [],
    remoteMigrations: [],
  }
}
