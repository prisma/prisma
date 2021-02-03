import path from 'path';
import Benchmark from 'benchmark'
import { compileFile } from '../../../../utils/compileFile'
import { generateTestClient } from '../../../../utils/getTestClient'

const suite = new Benchmark.Suite('typescript')

suite
  .add('client generation ~200 Models', {
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
  }).add('typescript compilation ~200 Models', {
    defer: true,
    fn: function (deferred) {
      compileFile(path.join(__dirname, './compile_test.ts'))
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
  .run()
