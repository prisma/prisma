// @ts-nocheck

import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import Benchmark from 'benchmark'
import path from 'path'

import { compileFile } from '../../../utils/compileFile'
import { generateTestClient } from '../../../utils/getTestClient'

let suite = withCodSpeed(new Benchmark.Suite('typescript')).add('client generation ~50 Models', {
  defer: true,
  fn: function (deferred) {
    generateTestClient({ projectDir: __dirname })
      .then(() => {
        deferred.resolve()
      })
      .catch((err) => {
        console.error(err)
        process.exit(1)
      })
  },
})

if (!process.env.CODSPEED_BENCHMARK) {
  suite = suite.add('typescript compilation ~50 Models', {
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
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
suite
  .on('cycle', (event) => {
    // Output benchmark result by converting benchmark result to string
    console.log(String(event.target))
  })
  .run()
