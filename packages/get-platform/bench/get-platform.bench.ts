import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import Benchmark from 'benchmark'

import { getBinaryTargetForCurrentPlatformInternal, getos } from '../src/getPlatform'

void withCodSpeed(new Benchmark.Suite('get-platform'))
  .add('getBinaryTargetForCurrentPlatform', {
    defer: true,
    fn: async (deferred: Benchmark.Deferred) => {
      const os = await getos()
      getBinaryTargetForCurrentPlatformInternal(os)
      deferred.resolve()
    },
  })
  .on('cycle', (event: Benchmark.Event) => {
    console.log(String(event.target))
  })
  .run()
