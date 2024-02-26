// import Big from 'big.js/big.mjs'
// // import { webcrypto as crypto } from 'crypto' // for testing for now
// import Dec from 'decimal.js'

// const TARGET_BUILD_TYPE: string = 'edge' // for testing for now

// type staticDecProps = keyof typeof Decimal & {}
// type instanceDecProps = keyof Decimal & {}

// type DiffStaticInstanceProps = Exclude<instanceDecProps, staticDecProps>

// class Decimal extends Big {
//   static ROUND_UP = Decimal.roundUp
//   static ROUND_DOWN = Decimal.roundDown
//   static ROUND_HALF_UP = Decimal.roundHalfUp
//   static ROUND_HALF_EVEN = Decimal.roundHalfEven

//   static isDecimal(value: any): boolean {
//     return value instanceof Big
//   }

//   static random(sd = 20): Decimal {
//     if (TARGET_BUILD_TYPE === 'wasm' || TARGET_BUILD_TYPE === 'edge') {
//       const bytes = crypto.getRandomValues(new Uint8Array(sd))
//       const result = bytes.reduce((acc, byte) => acc + byte, '')
//       return new Decimal(`0.${result.slice(0, sd)}`)
//     } else {
//       throw new Error('Not implemented for Node.js yet')
//     }
//   }

//   static set({
//     ...args
//   }: {
//     toExpPos?: number
//     toExpNeg?: number
//     rounding?: 0 | 1 | 2 | 3 | 4
//     precision?: number

//     minE?: number
//     maxE?: number
//     crypto?: boolean
//     modulo?: Modulo
//     defaults?: boolean
//   }) {
//     Big.PE = args.toExpPos ?? Big.PE
//     Big.NE = args.toExpNeg ?? Big.NE
//     Big.RM = args.rounding ?? Big.RM
//     Big.DP = args.precision ?? Big.DP
//   }

//   static add(a: Decimal, b: Decimal) {
//     return a.add(b)
//   }

//   static plus(a: Decimal, b: Decimal) {
//     return a.plus(b)
//   }

//   static sub(a: Decimal, b: Decimal) {
//     return a.sub(b)
//   }

//   static minus(a: Decimal, b: Decimal) {
//     return a.minus(b)
//   }

//   static mul(a: Decimal, b: Decimal) {
//     return a.mul(b)
//   }

//   static times(a: Decimal, b: Decimal) {
//     return a.times(b)
//   }

//   static div(a: Decimal, b: Decimal) {
//     return a.div(b)
//   }

//   static mod(a: Decimal, b: Decimal) {
//     return a.mod(b)
//   }

//   static pow(a: Decimal, exp: number) {
//     return a.pow(exp)
//   }

//   static sqrt(a: Decimal) {
//     return a.sqrt()
//   }

//   static abs(a: Decimal) {
//     return a.abs()
//   }

//   static cmp(a: Decimal, b: Decimal) {
//     return a.cmp(b)
//   }

//   static eq(a: Decimal, b: Decimal) {
//     return a.eq(b)
//   }

//   static lt(a: Decimal, b: Decimal) {
//     return a.lt(b)
//   }

//   static lte(a: Decimal, b: Decimal) {
//     return a.lte(b)
//   }

//   static gt(a: Decimal, b: Decimal) {
//     return a.gt(b)
//   }

//   static gte(a: Decimal, b: Decimal) {
//     return a.gte(b)
//   }

//   static neg(a: Decimal) {
//     return a.neg()
//   }

//   static round(a: Decimal) {
//     return a.round()
//   }

//   static ceil(a: Decimal) {
//     return a.round(0, Decimal.roundUp)
//   }

//   static floor(a: Decimal) {
//     return a.round(0, Decimal.roundDown)
//   }

//   static sign(a: Decimal) {
//     return a['c'][0] === 0 ? 0 : a['s']
//   }

//   static trunc(a: Decimal) {
//     return new Decimal(a.toFixed(0))
//   }
// }

// export default Decimal

// // Decimal.set({
// //   precision: 200000,
// // })

// // const c = new Decimal('1e-500')

// // console.log(c.toString())

// import light from 'big.js/big.mjs'
import DecimalLight from 'decimal.js-light/decimal.mjs'

export class Decimal extends DecimalLight {
  static isDecimal(value: any): boolean {
    return value instanceof DecimalLight
  }

  static random(sd = 20): Decimal {
    if (TARGET_BUILD_TYPE === 'wasm' || TARGET_BUILD_TYPE === 'edge') {
      const bytes = crypto.getRandomValues(new Uint8Array(sd))
      const result = bytes.reduce((acc, byte) => acc + byte, '')
      return new DecimalLight(`0.${result.slice(0, sd)}`)
    } else {
      throw new Error('Not implemented for Node.js yet')
    }
  }

  static set = DecimalLight.config
}

// export default light
