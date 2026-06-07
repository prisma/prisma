import { getCallSite } from './CallSite'

const originalTargetBuildType = (globalThis as any).TARGET_BUILD_TYPE

beforeEach(() => {
  ;(globalThis as any).TARGET_BUILD_TYPE = 'client'
})

afterAll(() => {
  if (originalTargetBuildType === undefined) {
    delete (globalThis as any).TARGET_BUILD_TYPE
  } else {
    ;(globalThis as any).TARGET_BUILD_TYPE = originalTargetBuildType
  }
})

test('reuses disabled callsite for minimal error format', () => {
  const first = getCallSite('minimal')
  const second = getCallSite('minimal')

  expect(first).toBe(second)
  expect(first.getLocation()).toBeNull()
})

test('keeps enabled callsites distinct for non-minimal error format', () => {
  expect(getCallSite('colorless')).not.toBe(getCallSite('colorless'))
})
