import type { JsonQueryAction } from '../engines'

const writeMap: Record<JsonQueryAction, boolean> = {
  aggregate: false,
  aggregateRaw: false,
  createMany: true,
  createManyAndReturn: true,
  createOne: true,
  deleteMany: true,
  deleteOne: true,
  executeRaw: true,
  findFirst: false,
  findFirstOrThrow: false,
  findMany: false,
  findRaw: false,
  findUnique: false,
  findUniqueOrThrow: false,
  groupBy: false,
  queryRaw: false,
  runCommandRaw: true,
  updateMany: true,
  updateManyAndReturn: true,
  updateOne: true,
  upsertOne: true,
}

export function isWrite(action: JsonQueryAction): boolean {
  return writeMap[action]
}
