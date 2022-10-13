import { createCompositeProxy } from './createCompositeProxy'
import { forwardTo } from './forwardTo'

test('forwards properties to a target object', () => {
  const target = { first: 1 }
  const extensions = { second: 2, third: 3 }

  const proxy = createCompositeProxy(target, [forwardTo(extensions)])

  expect(Object.keys(proxy)).toEqual(['first', 'second', 'third'])
  expect(proxy).toHaveProperty('first', 1)
  expect(proxy).toHaveProperty('second', 2)
  expect(proxy).toHaveProperty('third', 3)
})
