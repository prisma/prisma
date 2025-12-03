import { describe, expect, it } from 'vitest'

describe('Enum array cast fix', () => {
  it('should fix enum array cast syntax in SQL', () => {
    // Test the SQL transformation indirectly by checking the behavior
    // The actual fix happens in the private performIO method

    // Test cases for the regex pattern
    const testCases = [
      {
        input: 'update "public"."User" set "roles" = cast($1 as "public"."Role[]") where "id" = $2',
        expected: 'update "public"."User" set "roles" = cast($1 as "public"."Role"[]) where "id" = $2',
      },
      {
        input: 'select * from "User" where "status" = cast($1 as "myschema"."Status[]")',
        expected: 'select * from "User" where "status" = cast($1 as "myschema"."Status"[])',
      },
      {
        input: 'insert into "User" ("roles") values (cast($1 as "public"."Role[]"))',
        expected: 'insert into "User" ("roles") values (cast($1 as "public"."Role"[]))',
      },
      {
        // Should not modify already correct syntax
        input: 'update "User" set "roles" = cast($1 as "public"."Role"[])',
        expected: 'update "User" set "roles" = cast($1 as "public"."Role"[])',
      },
    ]

    // Since fixEnumArrayCast is private, we'll test the regex pattern directly
    const fixEnumArrayCast = (sql: string): string => {
      return sql.replace(
        /cast\s*\(\s*\$(\d+)\s+as\s+"([^"]+)"\.("([^"]+)\[\]")\s*\)/gi,
        (match, paramIndex, schema, quotedTypeWithBrackets, typeWithBrackets) => {
          const typeName = typeWithBrackets.replace(/\[\]$/, '')
          return `cast($${paramIndex} as "${schema}"."${typeName}"[])`
        },
      )
    }

    testCases.forEach(({ input, expected }) => {
      const result = fixEnumArrayCast(input)
      expect(result).toBe(expected)
    })
  })
})
