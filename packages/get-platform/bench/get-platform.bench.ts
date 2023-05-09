import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import Benchmark from 'benchmark'

import { getPlatform } from '../src/getPlatform'

void withCodSpeed(new Benchmark.Suite('get-platform'))
  .add('getPlatform', {
    defer: true,
    fn: async (deferred: Benchmark.Deferred) => {
      await getPlatform()
      deferred.resolve()
    },
  })
  .on('cycle', (event: Benchmark.Event) => {
    console.log(String(event.target))
  })
  .run()
