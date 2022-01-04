// Due to a TypeScript bug, we're shipping these core types for now
export type Exclude<T, U> = T extends U ? never : T

export type Omit<T, K extends keyof any> = { [P in Exclude<keyof T, K>]: T[P] }

export function omit<T extends object, K extends keyof T>(object: T, path: K | K[]): Omit<T, K> {
  const result: any = {}
  const paths = Array.isArray(path) ? path : [path]
  for (const key in object) {
    if (Object.hasOwnProperty.call(object, key) && !paths.includes(key as any)) {
      result[key] = object[key]
    }
  }
  return result
}
