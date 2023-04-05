import { PrismaPromise } from './PrismaPromise'

export function isPrismaPromise(value: any): value is PrismaPromise<any> {
  return value instanceof Promise && value[Symbol.toStringTag] === 'PrismaPromise'
}
