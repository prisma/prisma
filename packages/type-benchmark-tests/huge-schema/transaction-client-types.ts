import type { Prisma, PrismaClient } from './generated/client'

declare const client: PrismaClient
declare const tx: Prisma.TransactionClient

// PrismaClient is assignable to TransactionClient (positive contract).
const _positive: Prisma.TransactionClient = client

// TransactionClient is not assignable to PrismaClient: it is missing the
// members denied inside interactive transactions.
// @ts-expect-error TransactionClient is missing the members denied inside interactive transactions
const _negative: PrismaClient = tx

// The members denied inside interactive transactions are absent from
// TransactionClient. Each assertion below intentionally errors today: if any
// denied member leaks back onto TransactionClient, the corresponding
// directive becomes unused and tsc fails with TS2578.
// @ts-expect-error $connect is denied on TransactionClient
const _connect: { $connect: () => void } = tx
// @ts-expect-error $disconnect is denied on TransactionClient
const _disconnect: { $disconnect: () => void } = tx
// @ts-expect-error $on is denied on TransactionClient
const _on: { $on: () => void } = tx
// @ts-expect-error $extends is denied on TransactionClient
const _extends: { $extends: () => void } = tx

void _negative
void _connect
void _disconnect
void _on
void _extends
void _positive
