import { EnumUnused, EnumUsed } from '@prisma/client'

test('can import enum from browser bundle', () => {
  expect(EnumUsed).toEqual({
    A: 'A',
    B: 'B',
  })

  expect(EnumUnused).toEqual({
    C: 'C',
    D: 'D',
  })
})

export {}
