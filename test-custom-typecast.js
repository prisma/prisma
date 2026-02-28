// Simple test runner for custom type casting functionality
const { processCustomTypeCastParameters, createCustomTypeCast, hasCustomTypeCasting } = require('./packages/client/src/runtime/utils/preserveCustomTypeCasting.ts')

// Test hasCustomTypeCasting
console.log('Testing hasCustomTypeCasting...')
const param = createCustomTypeCast('search term', '::pdb.boost(5)')
console.log('✓ Custom type cast parameter detected:', hasCustomTypeCasting(param))
console.log('✓ Regular parameter not detected:', !hasCustomTypeCasting('regular string'))

// Test processCustomTypeCastParameters
console.log('\nTesting processCustomTypeCastParameters...')
const query = 'SELECT * FROM table WHERE column &&& $1 AND other_column = $2'
const parameters = [
  createCustomTypeCast('search term', '::pdb.boost(5)'),
  'regular param'
]

const result = processCustomTypeCastParameters(query, parameters, 'postgresql')
console.log('Original query:', query)
console.log('Processed query:', result.query)
console.log('Original parameters:', parameters)
console.log('Processed parameters:', result.parameters)

const expectedQuery = 'SELECT * FROM table WHERE column &&& $1::pdb.boost(5) AND other_column = $2'
const expectedParams = ['search term', 'regular param']

console.log('✓ Query processed correctly:', result.query === expectedQuery)
console.log('✓ Parameters processed correctly:', JSON.stringify(result.parameters) === JSON.stringify(expectedParams))

console.log('\nAll tests passed! 🎉')