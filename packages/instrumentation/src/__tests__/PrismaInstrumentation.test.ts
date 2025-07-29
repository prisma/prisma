import { GLOBAL_INSTRUMENTATION_ACCESSOR_KEY, GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY } from '../constants'
import { PrismaInstrumentation } from '../PrismaInstrumentation'

describe('PrismaInstrumentation', () => {
  const instance = new PrismaInstrumentation()

  test('should set helper global accessor key when enabled', () => {
    instance.enable()

    expect(global[GLOBAL_INSTRUMENTATION_ACCESSOR_KEY]?.helper).toBeDefined()
    expect(global[GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY].helper).toBeDefined()
  })

  test('should return when calling isEnabled', () => {
    expect(instance.isEnabled()).toEqual(true)
  })

  test('should disable setting global var', () => {
    instance.disable()

    expect(global[GLOBAL_INSTRUMENTATION_ACCESSOR_KEY]).toBeUndefined()
    expect(global[GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY]).toBeUndefined()
  })
})
