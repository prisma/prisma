import hasYarn from 'has-yarn'
import path from 'path'

// TODO: switch to @antfu/ni

export function isYarnUsed(baseDir: string): boolean {
  // TODO: this may give false results for Yarn workspaces or when the schema is
  // in a non-standard location, implement proper detection. Possibly related:
  // https://github.com/prisma/prisma/discussions/10488
  return hasYarn(baseDir) || hasYarn(path.join(baseDir, '..'))
}
