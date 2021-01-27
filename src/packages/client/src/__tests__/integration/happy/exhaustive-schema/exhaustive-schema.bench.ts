import Benchmark from 'benchmark'
import { generateTestClient } from '../../../../utils/getTestClient'

const suite = new Benchmark.Suite()

suite
  .add('client generation', {
    defer: true,
    fn: function (deferred) {
      generateTestClient().then<void>(() => {
        deferred.resolve()
      })
    },
  })
  .on('complete', function () {
    // console.log(this[0].stats)
  })
  .on('cycle', (event) => {
    // Output benchmark result by converting benchmark result to string
    console.log(String(event.target))
  })
  .run()
