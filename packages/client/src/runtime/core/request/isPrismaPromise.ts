import { PrismaPromiseInternal } from './PrismaPromise'

export function isPrismaPromise(value: any): value is PrismaPromiseInternal<any> {
  return value && value[Symbol.toStringTag] === 'PrismaPromise'
}
