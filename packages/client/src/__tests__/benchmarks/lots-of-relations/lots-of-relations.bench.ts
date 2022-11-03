// @ts-nocheck

import Benchmark from 'benchmark'

import { generateTestClient } from '../../../utils/getTestClient'

const suite = new Benchmark.Suite('typescript')
// @ts-ignore
suite
  .add('client generation 100 models with relations', {
    defer: true,
    fn: function (deferred) {
      generateTestClient(__dirname)
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
