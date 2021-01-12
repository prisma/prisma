import { expectError } from 'tsd'
import { PrismaClient } from '.'

// tslint:disable

const p1 = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectError(
    new PrismaClient({
      rejectOnNotFound: 'true',
    }),
  )
  expectError(
    new PrismaClient({
      rejectOnNotFound: {
        NotAModel: new Error('Contructor Custom Error on User'),
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
})()
