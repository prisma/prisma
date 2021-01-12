import { expectError } from 'tsd';
import { PrismaClient } from '.';

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
      rejectNotFound: 'true'
    })
  )
  expectError(
    new PrismaClient({
      rejectNotFound: {
        NotAModel: new Error('Contructor Custom Error on User'),
      },
    })
  )
  // findUnique
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectNotFound: [true]
    })
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectNotFound: 'false'
    })
  )
  expectError(
    p1.user.findUnique({
      where: { id: 'anything'},
      rejectNotFound: {}
    })
  )

  //findFirst
  expectError(
    p1.user.findFirst({
      where: { id: 'anything'},
      rejectNotFound: [true]
    })
  )
  expectError(
    p1.user.findFirst({
      where: { id: 'anything'},
      rejectNotFound: 'false'
    })
  )
  expectError(
    p1.user.findFirst({
      where: { id: 'anything'},
      rejectNotFound: {}
    })
  )
})()
