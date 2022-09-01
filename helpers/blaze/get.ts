import { U } from 'ts-toolbelt'

function get<O extends object, K extends keyof OM, OM = U.Merge<O>>(object: O, key: K): OM[K] {
  return object[key as any]
}

export { get }
