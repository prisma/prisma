import { __dirname } from './dirname'
import { __filename } from './filename'

export function evaluate(x: string) {
  const regex = /__dirname|__filename/g

  const esmX = x.replace(regex, (match) => {
    if (match === '__dirname') {
      return __dirname
    }

    if (match === '__filename') {
      // @ts-ignore
      return __filename
    }

    return match
  })

  return Function(esmX)()
}