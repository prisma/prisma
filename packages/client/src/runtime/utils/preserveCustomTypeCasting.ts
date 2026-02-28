/**
 * Preserves PostgreSQL extension-specific type casting in raw queries.
 * This handles cases where parameters need custom type casting like ParadeDB's pdb.boost(), pdb.fuzzy(), etc.
 */

export interface CustomTypeCastParameter {
  value: unknown
  typeCast?: string
}

/**
 * Detects if a parameter contains custom type casting syntax
 */
export function hasCustomTypeCasting(param: unknown): param is CustomTypeCastParameter {
  return (
    typeof param === 'object' &&
    param !== null &&
    'value' in param &&
    'typeCast' in param &&
    typeof (param as CustomTypeCastParameter).typeCast === 'string'
  )
}

/**
 * Processes parameters to handle custom type casting for PostgreSQL extensions
 */
export function processCustomTypeCastParameters(
  query: string,
  parameters: unknown[],
  activeProvider: string
): { query: string; parameters: unknown[] } {
  // Only process for PostgreSQL-compatible providers
  if (activeProvider !== 'postgresql' && activeProvider !== 'cockroachdb') {
    return { query, parameters }
  }

  let processedQuery = query
  const processedParameters: unknown[] = []
  let paramIndex = 0

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i]
    
    if (hasCustomTypeCasting(param)) {
      // Replace the parameter placeholder with the custom type cast
      const placeholder = `$${paramIndex + 1}`
      const customCast = `$${paramIndex + 1}${param.typeCast}`
      
      processedQuery = processedQuery.replace(placeholder, customCast)
      processedParameters.push(param.value)
    } else {
      processedParameters.push(param)
    }
    
    paramIndex++
  }

  return { query: processedQuery, parameters: processedParameters }
}

/**
 * Helper function to create a custom type cast parameter
 */
export function createCustomTypeCast(value: unknown, typeCast: string): CustomTypeCastParameter {
  return { value, typeCast }
}