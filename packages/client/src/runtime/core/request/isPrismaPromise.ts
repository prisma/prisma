import { PrismaPromise } from './PrismaPromise'

export function isPrismaPromise(value: any): value is PrismaPromise<any> {
  return value && value[Symbol.toStringTag] === 'PrismaPromise'
}
