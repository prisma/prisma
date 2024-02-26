import Big from 'big.js'

Big.prototype.ceil = function (this: Big) {
  return this.round(0, Decimal.roundUp)
}

Big.prototype.floor = function (this: Big) {
  return this.round(0, Decimal.roundDown)
}

Big.prototype.sign = function (this: Big) {
  return this['c'][0] === 0 ? 0 : this['s']
}

Big.prototype.trunc = function (this: Big) {
  return new Decimal(this.toFixed(0))
}

class Decimal extends Big {
  static ROUND_UP = Decimal.roundUp
  static ROUND_DOWN = Decimal.roundDown
  static ROUND_HALF_UP = Decimal.roundHalfUp
  static ROUND_HALF_EVEN = Decimal.roundHalfEven

  static isDecimal(value: any): boolean {
    return value instanceof Big
  }

  static random(sd = 20): Decimal {
    if (TARGET_BUILD_TYPE === 'wasm' || TARGET_BUILD_TYPE === 'edge') {
      const bytes = crypto.getRandomValues(new Uint8Array(sd))
      const result = bytes.reduce((acc, byte) => acc + byte, '')
      return new Decimal(`0.${result.slice(0, sd)}`)
    } else {
      throw new Error('Not implemented for Node.js yet')
    }
  }

  static set({ ...args }: { toExpPos?: number; toExpNeg?: number; rounding?: 0 | 1 | 2 | 3 | 4; precision?: number }) {
    Big.PE = args.toExpPos ?? Big.PE
    Big.NE = args.toExpNeg ?? Big.NE
    Big.RM = args.rounding ?? Big.RM
    Big.DP = args.precision ?? Big.DP
  }
}

// also adds all instance methods as static methods
for (const key of Object.getOwnPropertyNames(Big.prototype)) {
  if (typeof Big.prototype[key] === 'function') {
    Decimal[key] = Big.prototype[key].call
  }
}

export default Decimal
export { Decimal }
