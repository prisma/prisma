import { createCompositeProxy } from './createCompositeProxy'

test('forwards properties to the target', () => {
  const target = { foo: 'bar' }
  const proxy = createCompositeProxy(target, [])

  expect(proxy.foo).toBe('bar')
})

test('allows to set property', () => {
  const proxy = createCompositeProxy({} as Record<string, unknown>, [])

  proxy.foo = 1

  expect(Object.keys(proxy)).toEqual(['foo'])
  expect(proxy.foo).toBe(1)
})

test('allows to add extra properties via layers', () => {
  const proxy = createCompositeProxy({ first: 1 }, [
    {
      getKeys() {
        return ['second']
      },

      getPropertyValue() {
        return 2
      },
    },
  ])

  expect(Object.keys(proxy)).toEqual(['first', 'second'])
  expect(proxy).toHaveProperty('first', 1)
  expect(proxy).toHaveProperty('second', 2)
})

test('allows to add multiple properties via single layer', () => {
  const proxy = createCompositeProxy({}, [
    {
      getKeys() {
        return ['first', 'second']
      },

      getPropertyValue(key) {
        return key === 'first' ? 1 : 2
      },
    },
  ])

  expect(Object.keys(proxy)).toEqual(['first', 'second'])
  expect(proxy).toHaveProperty('first', 1)
  expect(proxy).toHaveProperty('second', 2)
})

test('does not add layers for undeclared keys', () => {
  const getPropertyValue = jest.fn()
  const proxy = createCompositeProxy({} as Record<string, unknown>, [
    {
      getKeys() {
        return ['first']
      },

      getPropertyValue,
    },
  ])

  expect(proxy.third).toBeUndefined()
  expect(getPropertyValue).not.toHaveBeenCalled()
})

test('allows to have several layers', () => {
  const proxy = createCompositeProxy({ first: 1 }, [
    {
      getKeys() {
        return ['second']
      },

      getPropertyValue() {
        return 2
      },
    },
    {
      getKeys() {
        return ['third']
      },

      getPropertyValue(key) {
        return 3
      },
    },
  ])

  expect(Object.keys(proxy)).toEqual(['first', 'second', 'third'])
  expect(proxy).toHaveProperty('first', 1)
  expect(proxy).toHaveProperty('second', 2)
  expect(proxy).toHaveProperty('third', 3)
})

test('allows to override target property', () => {
  const proxy = createCompositeProxy({ value: 'original' }, [
    {
      getKeys() {
        return ['value']
      },

      getPropertyValue(key) {
        return 'override'
      },
    },
  ])

  expect(proxy).toHaveProperty('value', 'override')
})

test('last override wins', () => {
  const proxy = createCompositeProxy({ value: 'original' }, [
    {
      getKeys() {
        return ['value']
      },

      getPropertyValue(key) {
        return 'override 1'
      },
    },

    {
      getKeys() {
        return ['value']
      },

      getPropertyValue(key) {
        return 'override 2'
      },
    },
  ])

  expect(proxy).toHaveProperty('value', 'override 2')
})

test('recalculates property on every access', () => {
  let counter = 0
  const proxy = createCompositeProxy({} as Record<string, number>, [
    {
      getKeys() {
        return ['prop']
      },

      getPropertyValue() {
        return counter++
      },
    },
  ])

  expect(proxy.prop).toBe(0)
  expect(proxy.prop).toBe(1)
  expect(proxy.prop).toBe(2)
})

test('allows to override a property from a layer', () => {
  const target = {} as Record<string, unknown>

  const proxy = createCompositeProxy(target, [
    {
      getKeys() {
        return ['prop']
      },

      getPropertyValue() {
        return 'from proxy'
      },
    },
  ])

  proxy.prop = 'override'

  expect(target.prop).toBe('override')
  expect(proxy.prop).toBe('override')
})
