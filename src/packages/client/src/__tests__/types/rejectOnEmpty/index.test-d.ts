import { PrismaClient } from '.'
import { expectError } from 'tsd'

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
      rejectOnEmpty: 'true'
    })
  )
  expectError(
    new PrismaClient({
      rejectOnEmpty: {
        NotAModel: new Error('Contructor Custom Error on User'),
      },
    })
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectOnEmpty: [true]
    })
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectOnEmpty: 'false'
    })
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectOnEmpty: {}
    })
  )
})()
