// @ts-nocheck

import Benchmark from 'benchmark'
import execa from 'execa'
import fs from 'fs'
import path from 'path'

import { compileFile } from '../../../utils/compileFile'
import { generateTestClient } from '../../../utils/getTestClient'

const suite = new Benchmark.Suite('typescript')
// @ts-ignore
suite
  .add('client generation ~50 Models', {
    defer: true,
    fn: function (deferred) {
      generateTestClient()
        .then(() => {
          deferred.resolve()
        })
        .catch((err) => {
          console.error(err)
          process.exit(1)
        })
    },
  })
  .add('typescript compilation ~50 Models', {
    defer: true,
    fn: function (deferred) {
      compileFile(path.join(__dirname, './compile.ts'))
        .then(() => {
          deferred.resolve()
        })
        .catch((err) => {
          console.error(err)
          process.exit(1)
        })
    },
  })
  .on('cycle', (event) => {
    // Output benchmark result by converting benchmark result to string
    console.log(String(event.target))
  })
  .on('complete', () => {
    printSize('./node_modules/@prisma/client')
    printSize('./node_modules/.prisma/client')
    printSize('./node_modules/.prisma/client/index.d.ts')
    printSize('./node_modules/.prisma/client/index.js')
    // For GitHub CI
    if (process.env.CI) {
      printSize('./node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node')
    }
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
  })
  .run()

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
