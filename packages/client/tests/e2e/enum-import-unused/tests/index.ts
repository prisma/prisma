import { EnumUnused, EnumUsed, Prisma } from '@prisma/client'

test('can import enum from browser bundle', () => {
  // `enum` for Prisma utility functions
  expect(Prisma.TransactionIsolationLevel.ReadUncommitted).toEqual('ReadUncommitted')

  // `enum` that is used in at least one `model`
  expect(EnumUsed).toEqual({
    A: 'A',
    B: 'B',
  })

  // `enum` that isn't used in any `model`
  expect(EnumUnused).toEqual({
    C: 'C',
    D: 'D',
  })
})
