import { Role } from '@prisma/client/index-browser'

test('example', () => {
  expect(Role).toEqual({
    USER: 'USER',
    ADMIN: 'ADMIN',
  })
})

export {}
