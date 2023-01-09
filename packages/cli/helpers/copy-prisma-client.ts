import fg from 'fast-glob'
import { copySync } from 'fs-extra'
import path from 'path'

// that's where we want to copy the local client for @prisma/studio
const clientCopyPath = path.join(__dirname, '..', 'prisma-client')

// we resolve where the client is located via our own dependencies
const clientPath = path.dirname(require.resolve('@prisma/client'))
const clientPkg = require('@prisma/client/package.json')

// we compute the paths of the files that would get npm published
// this uses a glob library to understand patterns in files.
// Using tooling from npm would be even better, but it is in magnitudes slower compared to this approach.
// Ideally, it would be great if we could remove this somehow.
const clientFiles = fg.sync(clientPkg.files, { cwd: clientPath, dot: true, onlyFiles: false })

// we copy each file that we found in pkg to a new destination
for (const file of clientFiles) {
  const from = path.join(clientPath, file)
  const to = path.join(clientCopyPath, file)
  copySync(from, to, { overwrite: true, recursive: true })
}
