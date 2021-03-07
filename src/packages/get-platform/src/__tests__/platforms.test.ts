import { mayBeCompatible, Platform } from '../platforms'

type TestUnit = {
  platformA: Platform
  platformB: Platform
  result: boolean
}

const tests: Array<TestUnit> = [
  {
    platformA: 'native',
    platformB: `darwin`,
    result: true,
  },
  {
    platformA: 'native',
    platformB: `windows`,
    result: true,
  },
  {
    platformA: 'darwin',
    platformB: `darwin`,
    result: false,
  },
  {
    platformA: 'freebsd11',
    platformB: `linux-musl`,
    result: false,
  },
]

describe('mayBeCompatible', () => {
  for (const t of tests) {
    test(`Checking ${t.platformA} and ${t.platformB}`, () => {
      expect(mayBeCompatible(t.platformA, t.platformB)).toBe(t.result)
    })
  }
})
