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
    getSize('@prisma/client')
    getSize('.prisma/client')
  })
  .run()

const regex = new RegExp(/([\d]{1,99}([.]\d{1,99})?)(\w)/)

function getSize(packageName: string): { size: string; unit: string } {
  const output = execa.sync('du', ['-sh', `./node_modules/${packageName}`], {
    stdout: 'pipe',
    cwd: __dirname,
  })
  // "25M"
  const str = output.stdout.split('\t')[0]
  const match = regex.exec(str)
  const pkgSize = { size: match[1], unit: match[3] }
  console.log(
    `${packageName} size x ${pkgSize.size} ${pkgSize.unit}B ±0.00% (1 runs sampled)`,
  )
}
