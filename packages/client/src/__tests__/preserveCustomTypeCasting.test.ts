import { processCustomTypeCastParameters, createCustomTypeCast, hasCustomTypeCasting } from '../runtime/utils/preserveCustomTypeCasting'

describe('preserveCustomTypeCasting', () => {
  describe('hasCustomTypeCasting', () => {
    it('should detect custom type cast parameters', () => {
      const param = createCustomTypeCast('search term', '::pdb.boost(5)')
      expect(hasCustomTypeCasting(param)).toBe(true)
    })

    it('should return false for regular parameters', () => {
      expect(hasCustomTypeCasting('regular string')).toBe(false)
      expect(hasCustomTypeCasting(123)).toBe(false)
      expect(hasCustomTypeCasting(null)).toBe(false)
      expect(hasCustomTypeCasting({})).toBe(false)
    })
  })

  describe('createCustomTypeCast', () => {
    it('should create a custom type cast parameter', () => {
      const param = createCustomTypeCast('search term', '::pdb.boost(5)')
      expect(param).toEqual({
        value: 'search term',
        typeCast: '::pdb.boost(5)'
      })
    })
  })

  describe('processCustomTypeCastParameters', () => {
    it('should preserve custom type casting for PostgreSQL', () => {
      const query = 'SELECT * FROM table WHERE column &&& $1 AND other_column = $2'
      const parameters = [
        createCustomTypeCast('search term', '::pdb.boost(5)'),
        'regular param'
      ]

      const result = processCustomTypeCastParameters(query, parameters, 'postgresql')

      expect(result.query).toBe('SELECT * FROM table WHERE column &&& $1::pdb.boost(5) AND other_column = $2')
      expect(result.parameters).toEqual(['search term', 'regular param'])
    })

    it('should handle multiple custom type casts', () => {
      const query = 'SELECT * FROM table WHERE col1 &&& $1 OR col2 &&& $2'
      const parameters = [
        createCustomTypeCast('term1', '::pdb.boost(5)'),
        createCustomTypeCast('term2', '::pdb.fuzzy(1)::pdb.boost(3)')
      ]

      const result = processCustomTypeCastParameters(query, parameters, 'postgresql')

      expect(result.query).toBe('SELECT * FROM table WHERE col1 &&& $1::pdb.boost(5) OR col2 &&& $2::pdb.fuzzy(1)::pdb.boost(3)')
      expect(result.parameters).toEqual(['term1', 'term2'])
    })

    it('should not process for non-PostgreSQL providers', () => {
      const query = 'SELECT * FROM table WHERE column = $1'
      const parameters = [createCustomTypeCast('search term', '::pdb.boost(5)')]

      const result = processCustomTypeCastParameters(query, parameters, 'mysql')

      expect(result.query).toBe(query)
      expect(result.parameters).toEqual(parameters)
    })

    it('should handle mixed regular and custom type cast parameters', () => {
      const query = 'SELECT * FROM table WHERE col1 &&& $1 AND col2 = $2 AND col3 &&& $3'
      const parameters = [
        createCustomTypeCast('search1', '::pdb.boost(5)'),
        'regular param',
        createCustomTypeCast('search2', '::pdb.fuzzy(2)')
      ]

      const result = processCustomTypeCastParameters(query, parameters, 'postgresql')

      expect(result.query).toBe('SELECT * FROM table WHERE col1 &&& $1::pdb.boost(5) AND col2 = $2 AND col3 &&& $3::pdb.fuzzy(2)')
      expect(result.parameters).toEqual(['search1', 'regular param', 'search2'])
    })

    it('should work with CockroachDB', () => {
      const query = 'SELECT * FROM table WHERE column &&& $1'
      const parameters = [createCustomTypeCast('search term', '::pdb.boost(5)')]

      const result = processCustomTypeCastParameters(query, parameters, 'cockroachdb')

      expect(result.query).toBe('SELECT * FROM table WHERE column &&& $1::pdb.boost(5)')
      expect(result.parameters).toEqual(['search term'])
    })
  })
})