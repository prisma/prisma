import { expectError } from 'tsd'

import { PrismaClient } from '.'

const p1 = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
  rejectOnNotFound: true,
})

;(async () => {
  expectError(
    new PrismaClient({
      rejectOnNotFound: 'true',
    }),
  )
  expectError(
    new PrismaClient({
      rejectOnNotFound: new Error('Error'),
    }),
  )

  expectError(
    new PrismaClient({
      rejectOnNotFound: {
        NotAModel: new Error('Constructor Custom Error on User'),
      },
    }),
  )

  // findUnique
  expectError(
    p1.user.findUnique({
      where: { id: 'anything' },
      rejectOnNotFound: [true],
    }),
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything' },
      rejectOnNotFound: 'false',
    }),
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything' },
      rejectOnNotFound: {},
    }),
  )

  //findFirst
  expectError(
    p1.user.findFirst({
      where: { id: 'anything' },
      rejectOnNotFound: [true],
    }),
  )
  expectError(
    p1.user.findFirst({
      where: { id: 'anything' },
      rejectOnNotFound: 'false',
    }),
  )
  expectError(
    p1.user.findFirst({
      where: { id: 'anything' },
      rejectOnNotFound: {},
    }),
  )
  expectError(
    p1.user.findFirst({
      where: { id: 'anything' },
      rejectOnNotFound: {
        findUnique: new Error('Constructor Custom Error on User'),
        findFirst: true,
      },
    }),
  )
})()
