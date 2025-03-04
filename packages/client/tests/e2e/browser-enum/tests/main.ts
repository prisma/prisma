import { Role } from '@prisma/client/index-browser'

test('can import enum from browser bundle', () => {
  expect(Role).toEqual({
    USER: 'USER',
    ADMIN: 'ADMIN',
  })
})
