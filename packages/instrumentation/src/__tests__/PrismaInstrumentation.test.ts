import { GLOBAL_KEY } from '../constants'
import { PrismaInstrumentation } from '../PrismaInstrumentation'

describe('PrismaInstrumentation', () => {
  const instance = new PrismaInstrumentation()

  test('should enable setting global var', () => {
    instance.enable()

    expect(global[GLOBAL_KEY]).toBeDefined()
  })

  test('should return when calling isEnabled', () => {
    expect(instance.isEnabled()).toEqual(true)
  })

  test('should disable setting global var', () => {
    instance.disable()

    expect(global[GLOBAL_KEY]).toBeUndefined()
  })
})
