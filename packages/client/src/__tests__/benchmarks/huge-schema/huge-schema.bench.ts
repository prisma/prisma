// @ts-nocheck

import Benchmark from 'benchmark'
import execa from 'execa'
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
    getSize('./node_modules/@prisma/client')
    getSize('./node_modules/.prisma/client')
    getSize('./node_modules/.prisma/client/index.d.ts')
    getSize('./node_modules/.prisma/client/index.js')
    // For GitHub CI
    getSize('./node_modules/.prisma/client/query-engine-debian-openssl-1.1.x')
    // getSize('./node_modules/.prisma/client/query-engine-darwin')

    // Zip .prisma/client and @prisma/client and check size
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
    getSize('./dotPlusAtPrismaClientFolder.zip')
  })
  .run()

const regex = new RegExp(/([\d]{1,99}([.]\d{1,99})?)(\w)/)

function getSize(targetPath: string): { size: string; unit: string } {
  // const listFiles = execa.sync('ls', ['-la', `./node_modules/${targetPath}`], {
  //   stdout: 'pipe',
  //   cwd: __dirname,
  // })
  // console.log(listFiles)

  const output = execa.sync('du', ['-sh', targetPath], {
    stdout: 'pipe',
    cwd: __dirname,
  })
  const str = output.stdout.split('\t')[0]
  const match = regex.exec(str)
  const pkgSize = { size: match[1], unit: match[3] }
  console.log(
    `${targetPath.replace('./node_modules/', '').replace('./', '')} size x ${pkgSize.size} ${
      pkgSize.unit
    }B ±0.00% (1 runs sampled)`,
  )

  return pkgSize
}
