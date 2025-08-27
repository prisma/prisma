import { Prisma, Role } from '../client/browser'

test('can import enum from browser bundle', () => {
  expect(Role).toEqual({
    USER: 'USER',
    ADMIN: 'ADMIN',
  })
})

test('can use decimal.js', () => {
  const num = Prisma.Decimal('15.345678912356765')
  expect(num.floor().toNumber()).toEqual(15)
})

test('can use utility types', () => {
  expect(typeof Prisma.DbNull).toEqual('object')
  expect(typeof Prisma.AnyNull).toEqual('object')
  expect(typeof Prisma.JsonNull).toEqual('object')
})

test('can access model names', () => {
  expect(Prisma.ModelName).toEqual({
    User: 'User',
  })
})

export {}
