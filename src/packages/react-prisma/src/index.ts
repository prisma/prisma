import { unstable_getCacheForType, Wakeable } from 'react'
// @ts-ignore
import { PrismaClient as PrismaClientConstructor, dmmf } from '.prisma/client'

enum STATUS {
  Pending,
  Resolved,
  Rejected,
}

const { Pending, Resolved, Rejected } = STATUS

type PendingRecord = {
  status: STATUS.Pending
  value: Wakeable
}

type ResolvedRecord = {
  status: STATUS.Resolved
  value: any
}

type RejectedRecord = {
  status: STATUS.Rejected
  value: any
}

type Record = PendingRecord | ResolvedRecord | RejectedRecord

function createRecordFromThenable(thenable): Record {
  const record: Record = {
    status: Pending,
    value: thenable,
  }
  thenable.then(
    (value) => {
      if (record.status === Pending) {
        const resolvedRecord: any = record
        resolvedRecord.status = Resolved
        resolvedRecord.value = value
      }
    },
    (err) => {
      if (record.status === Pending) {
        const rejectedRecord: any = record
        rejectedRecord.status = Rejected
        rejectedRecord.value = err
      }
    },
  )
  return record
}

function readRecordValue(record) {
  if (record.status === Resolved) {
    return record.value
  } else {
    throw record.value
  }
}

function lowercase(str) {
  return str.slice(0, 1).toLowerCase() + str.slice(1)
}

const queryOperations = {
  findMany: true,
  findFirst: true,
  findOne: true,
  findUnique: true,
  count: true,
}

// @ts-ignore
export function PrismaClient(this, options): PrismaClientConstructor {
  this.client = new PrismaClientConstructor(options)
  // Unique function per instance because it's used for cache identity.
  this.createRecordMap = function () {
    return new Map()
  }

  for (let i = 0; i < dmmf.mappings.modelOperations.length; i++) {
    const mapping = dmmf.mappings.modelOperations[i]
    const delegate = Object.create(null)
    const modelName = lowercase(mapping.model)

    const keys = Object.keys(this.client[modelName])
    for (let i = 0; i < keys.length; i++) {
      const method = keys[i]
      delegate[method] = (query) => {
        if (!queryOperations[method]) {
          throw new Error(`The mutation ${modelName}.${method} can't be used from \`react-prisma\`.
Please use \`@prisma/client\` directly for that.`)
        }
        const outerMap = unstable_getCacheForType(this.createRecordMap)

        const innerMap = outerMap
        const key = JSON.stringify(query)

        let record = innerMap.get(key)
        if (!record) {
          const thenable = this.client[modelName][method](query)
          record = createRecordFromThenable(thenable)
          innerMap.set(key, record)
        } else if (record instanceof Map) {
          throw new Error(
            'This query has received fewer parameters than the last time ' +
              'the same query was used. Always pass the exact number of ' +
              'parameters that the query needs.',
          )
        }
        const result = readRecordValue(record)
        return result
      }
    }

    this[modelName] = delegate
  }
}
