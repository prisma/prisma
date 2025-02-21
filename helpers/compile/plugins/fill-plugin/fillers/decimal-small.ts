import DecimalLight from 'decimal.js-light/decimal.mjs'

class Decimal extends DecimalLight {
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
}

export default Decimal
export { Decimal }
