import { expect, test } from 'vitest'

import { defaultRegistry } from './default'

test('default generators', () => {
  const generators = defaultRegistry.toInternal()
  expect(Object.keys(generators)).toEqual(['prisma-client-js', 'prisma-client-ts', 'prisma-client'])
  expect(generators['prisma-client']).toStrictEqual(generators['prisma-client-ts'])
})
