import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import Benchmark from 'benchmark'

import { getos, getPlatformInternal } from '../src/getPlatform'

void withCodSpeed(new Benchmark.Suite('get-platform'))
  .add('getPlatform', {
    defer: true,
    fn: async (deferred: Benchmark.Deferred) => {
      const os = await getos()
      getPlatformInternal(os)
      deferred.resolve()
    },
  })
  .on('cycle', (event: Benchmark.Event) => {
    console.log(String(event.target))
  })
  .run()
