import { expectAssignable, expectError, expectNotAssignable } from 'tsd'

import { PrismaClient, Prisma } from '.'

const prisma = new PrismaClient()

;(async () => {
  expectError(await prisma.$transaction([prisma.user.findMany(), prisma.$queryRaw`SELECT 1`, 'random string'], {}))
  expectError(await prisma.$transaction([prisma.$connect()]))
  expectError(await prisma.$transaction([prisma.$disconnect()]))
  expectError(await prisma.$transaction([new Promise((res) => res('You Shall Not Pass'))]))
  expectError(await prisma.$transaction([5]))
  expectError(await prisma.$transaction(['str']))
  expectError(await prisma.$transaction([{}]))
})()

declare const tx: Prisma.TransactionClient

// PrismaClient is assignable to TransactionClient.
expectAssignable<Prisma.TransactionClient>(prisma)

// TransactionClient is not assignable to PrismaClient (it is missing the
// members denied inside interactive transactions).
expectNotAssignable<PrismaClient>(tx)

// Members denied on TransactionClient are absent from it.
expectNotAssignable<{ $connect: () => void }>(tx)
expectNotAssignable<{ $disconnect: () => void }>(tx)
expectNotAssignable<{ $on: () => void }>(tx)
expectNotAssignable<{ $use: () => void }>(tx)
expectNotAssignable<{ $extends: () => void }>(tx)
