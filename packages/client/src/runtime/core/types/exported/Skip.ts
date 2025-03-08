// private symbol that prevents direct construction of a class
const secret = Symbol()

export class Skip {
  constructor(param?: symbol) {
    if (param !== secret) {
      throw new Error('Skip instance can not be constructed directly')
    }
  }

  ifUndefined<T>(value: T | undefined): T | Skip {
    if (value === undefined) {
      return skip
    }
    return value
  }
}

export const skip = new Skip(secret)

export function isSkip(value: unknown): value is Skip {
  return value instanceof Skip
}
