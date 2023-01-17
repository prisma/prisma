import { ClientEngineType } from '@prisma/internals'
import execa from 'execa'
import fs from 'fs'
import path from 'path'

import { setup } from './builder'

async function bench(): Promise<void> {
  await setup(ClientEngineType.Library)

  benchFolderSize()
  benchZippedFolderSize()

  // For GitHub CI
  if (process.env.CI) {
    await benchQueryEngineSize()
  }
}

bench()
  .then()
  .catch((err) => console.error(err))

async function benchQueryEngineSize() {
  printSize('./node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node')

  await setup(ClientEngineType.Binary)
  printSize('./node_modules/.prisma/client/query-engine-debian-openssl-1.1.x')
}

function benchFolderSize() {
  printSize('./node_modules/@prisma/client')
  printSize('./node_modules/.prisma/client')
  printSize('./node_modules/.prisma/client/index.d.ts')
  printSize('./node_modules/.prisma/client/index.js')
}

function benchZippedFolderSize() {
  execa.sync('rm', ['-rf', `./dotPlusAtPrismaClientFolder.zip`], {
    stdout: 'pipe',
    cwd: __dirname,
  })
  execa.sync(
    'zip',
    ['-r', 'dotPlusAtPrismaClientFolder.zip', './node_modules/.prisma/client', './node_modules/@prisma/client'],
    {
      stdout: 'pipe',
      cwd: __dirname,
    },
  )

  printSize('./dotPlusAtPrismaClientFolder.zip')
}

function printSize(targetPath: string): void {
  const size = getSize(path.join(__dirname, targetPath)) / 1024 / 1024

  console.log(
    `${targetPath.replace('./node_modules/', '').replace('./', '')} size x ${size} MB ±0.00% (1 runs sampled)`,
  )
}

function getSize(targetPath: string): number {
  const stat = fs.statSync(targetPath)

  if (stat.isFile()) {
    return stat.size
  }

  if (stat.isDirectory()) {
    return fs
      .readdirSync(targetPath)
      .filter((fileName) => fileName !== '.' && fileName !== '..')
      .map((subPath) => getSize(path.join(targetPath, subPath)))
      .reduce((a, b) => a + b)
  }
  return 0
}
