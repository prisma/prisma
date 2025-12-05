import { describe, expect, it } from 'vitest'

// Import the normalize_money function - we'll need to export it first
import { customParsers } from '../conversion'

const normalize_money = customParsers[790] as (money: string) => string

describe('normalize_money', () => {
  describe('null and undefined handling', () => {
    it('should return null for null input', () => {
      expect(normalize_money(null as any)).toBe(null)
    })

    it('should return undefined for undefined input', () => {
      expect(normalize_money(undefined as any)).toBe(undefined)
    })
  })

  describe('US format (period as decimal, comma as thousands)', () => {
    it('should handle $50,000.00 (with currency symbol)', () => {
      expect(normalize_money('$50,000.00')).toBe('50000.00')
    })

    it('should handle 50,000.00 (without currency symbol)', () => {
      expect(normalize_money('50,000.00')).toBe('50000.00')
    })

    it('should handle $1,234.56', () => {
      expect(normalize_money('$1,234.56')).toBe('1234.56')
    })

    it('should handle $1,234,567.89', () => {
      expect(normalize_money('$1,234,567.89')).toBe('1234567.89')
    })

    it('should handle simple decimal 123.45', () => {
      expect(normalize_money('123.45')).toBe('123.45')
    })

    it('should handle integer with commas 1,000', () => {
      expect(normalize_money('1,000')).toBe('1000')
    })
  })

  describe('EU format (comma as decimal, period as thousands)', () => {
    it('should handle 50.000,00 (EU format)', () => {
      expect(normalize_money('50.000,00')).toBe('50000.00')
    })

    it('should handle 1.234,56 (EU format)', () => {
      expect(normalize_money('1.234,56')).toBe('1234.56')
    })

    it('should handle 1.234.567,89 (EU format)', () => {
      expect(normalize_money('1.234.567,89')).toBe('1234567.89')
    })
  })

  describe('Ambiguous single separator cases', () => {
    it('should handle 1,234 (could be 1.234 or 1234) - assume thousands separator', () => {
      // With exactly 3 digits after comma, it's likely a thousands separator
      expect(normalize_money('1,234')).toBe('1234')
    })

    it('should handle 1,23 (likely decimal)', () => {
      // With 2 digits after comma, it's likely a decimal separator
      expect(normalize_money('1,23')).toBe('1.23')
    })

    it('should handle 1.234 (could be 1,234 or 1.234) - assume thousands separator', () => {
      // With exactly 3 digits after period, it's likely a thousands separator
      expect(normalize_money('1.234')).toBe('1234')
    })

    it('should handle 1.23 (likely decimal)', () => {
      // With 2 digits after period, it's already in correct format
      expect(normalize_money('1.23')).toBe('1.23')
    })
  })

  describe('negative values', () => {
    it('should handle negative with US format -$50,000.00', () => {
      expect(normalize_money('-$50,000.00')).toBe('-50000.00')
    })

    it('should handle negative -1,234.56', () => {
      expect(normalize_money('-1,234.56')).toBe('-1234.56')
    })

    it('should handle negative EU format -1.234,56', () => {
      expect(normalize_money('-1.234,56')).toBe('-1234.56')
    })

    it('should handle parentheses notation ($1,234.56)', () => {
      expect(normalize_money('($1,234.56)')).toBe('-1234.56')
    })
  })

  describe('currency symbols and formatting', () => {
    it('should handle USD $123.45', () => {
      expect(normalize_money('$123.45')).toBe('123.45')
    })

    it('should handle EUR €123,45', () => {
      expect(normalize_money('€123,45')).toBe('123.45')
    })

    it('should handle GBP £123.45', () => {
      expect(normalize_money('£123.45')).toBe('123.45')
    })

    it('should handle spaces $1 234.56', () => {
      expect(normalize_money('$1 234.56')).toBe('1234.56')
    })
  })

  describe('edge cases', () => {
    it('should handle zero 0.00', () => {
      expect(normalize_money('0.00')).toBe('0.00')
    })

    it('should handle zero with formatting $0.00', () => {
      expect(normalize_money('$0.00')).toBe('0.00')
    })

    it('should handle integer 100', () => {
      expect(normalize_money('100')).toBe('100')
    })

    it('should handle very large numbers', () => {
      expect(normalize_money('$999,999,999.99')).toBe('999999999.99')
    })

    it('should handle very small decimals 0.01', () => {
      expect(normalize_money('0.01')).toBe('0.01')
    })

    it('should handle three decimal places 123.456', () => {
      expect(normalize_money('123.456')).toBe('123.456')
    })
  })

  describe('real-world issue from bug report', () => {
    it('should handle the exact value from bug report: 50,000.00', () => {
      expect(normalize_money('50,000.00')).toBe('50000.00')
    })

    it('should handle PostgreSQL money format with currency', () => {
      expect(normalize_money('$50,000.00')).toBe('50000.00')
    })
  })

  describe('improved edge cases and robustness', () => {
    it('should handle empty string', () => {
      expect(normalize_money('')).toBe('0')
    })

    it('should handle whitespace only', () => {
      expect(normalize_money('   ')).toBe('0')
    })

    it('should handle plain zero', () => {
      expect(normalize_money('0')).toBe('0')
    })

    it('should handle negative zero', () => {
      expect(normalize_money('-0')).toBe('0')
    })

    it('should handle leading zeros with decimal 000123.45', () => {
      expect(normalize_money('000123.45')).toBe('123.45')
    })

    it('should handle leading zeros without decimal 00042', () => {
      expect(normalize_money('00042')).toBe('42')
    })

    it('should handle decimal starting with dot .99', () => {
      expect(normalize_money('.99')).toBe('0.99')
    })

    it('should handle negative decimal starting with dot -.50', () => {
      expect(normalize_money('-.50')).toBe('-0.50')
    })

    it('should handle multiple commas as thousands 1,234,567,890.12', () => {
      expect(normalize_money('1,234,567,890.12')).toBe('1234567890.12')
    })

    it('should handle multiple dots as thousands (EU) 1.234.567.890,12', () => {
      expect(normalize_money('1.234.567.890,12')).toBe('1234567890.12')
    })

    it('should handle malformed consecutive separators 1,,234.56', () => {
      expect(normalize_money('1,,234.56')).toBe('1234.56')
    })

    it('should handle malformed consecutive separators 1..234,56', () => {
      expect(normalize_money('1..234,56')).toBe('1234.56')
    })

    it('should handle space as thousands separator $ 1 234 567.89', () => {
      expect(normalize_money('$ 1 234 567.89')).toBe('1234567.89')
    })

    it('should handle no separator integer 12345', () => {
      expect(normalize_money('12345')).toBe('12345')
    })

    it('should handle negative no separator -12345', () => {
      expect(normalize_money('-12345')).toBe('-12345')
    })

    it('should handle mixed format with trailing zeros 1,234.00', () => {
      expect(normalize_money('1,234.00')).toBe('1234.00')
    })

    it('should handle very small decimal 0.001', () => {
      expect(normalize_money('0.001')).toBe('0.001')
    })

    it('should handle 12.345 (2 digits before, 3 after) as thousands', () => {
      expect(normalize_money('12.345')).toBe('12345')
    })

    it('should handle 123.456 (3+ digits before, 3 after) as decimal', () => {
      expect(normalize_money('123.456')).toBe('123.456')
    })

    it('should handle parentheses with EU format (€1.234,56)', () => {
      expect(normalize_money('(€1.234,56)')).toBe('-1234.56')
    })

    it('should handle parentheses with spaces ( $ 1,234.56 )', () => {
      expect(normalize_money('( $ 1,234.56 )')).toBe('-1234.56')
    })

    it('should handle parentheses with simple number (42)', () => {
      expect(normalize_money('(42)')).toBe('-42')
    })

    it('should handle parentheses with decimal (0.99)', () => {
      expect(normalize_money('(0.99)')).toBe('-0.99')
    })
  })
})
