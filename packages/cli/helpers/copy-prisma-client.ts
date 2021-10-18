import { copySync } from 'fs-extra'
import path from 'path'

// that's where we want to copy the local client for @prisma/studio
const clientCopyPath = path.join(__dirname, '..', 'prisma-client')

// we resolve where the client is located via our own dependencies
const clientPath = path.dirname(require.resolve('@prisma/client'))
const clientPkg = require('@prisma/client/package.json')

// we compute the paths of the files that would get npm published
const clientFiles = (clientPkg.files ?? []).map((file: string) =>
  path.join(clientPath, file),
)

// we copy each file that we found in pkg to a new destination
for (const file of clientFiles) {
  const dest = path.join(clientCopyPath, path.basename(file))
  copySync(file, dest, { recursive: true, overwrite: true })
}
