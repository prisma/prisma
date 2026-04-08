import { describe, expect, it } from 'vitest'

import { parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - security: no user data leakage', () => {
  const sensitiveValues = [
    'password123',
    'secret-api-key',
    'user@private.email',
    'SSN-123-45-6789',
    'credit-card-1234-5678',
    '{"sensitive":"data"}',
  ]

  describe('where clauses', () => {
    it('does not leak string values in where clauses', () => {
      for (const sensitive of sensitiveValues) {
        const query = {
          arguments: { where: { field: sensitive } },
          selection: { $scalars: true },
        }

        const result = parameterizeQuery(query)
        const resultStr = JSON.stringify(result)
        expect(resultStr).not.toContain(sensitive)
      }
    })

    it('does not leak numeric values that could be IDs', () => {
      const sensitiveId = 98765432

      const query = {
        arguments: { where: { id: sensitiveId } },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(String(sensitiveId))
    })

    it('does not leak values in nested where conditions', () => {
      const sensitive = 'secret-nested-value'

      const query = {
        arguments: {
          where: {
            user: {
              profile: {
                bio: sensitive,
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitive)
    })
  })

  describe('data clauses', () => {
    it('does not leak string values in data clauses', () => {
      for (const sensitive of sensitiveValues) {
        const query = {
          arguments: { data: { field: sensitive } },
          selection: { $scalars: true },
        }

        const result = parameterizeQuery(query)
        const resultStr = JSON.stringify(result)
        expect(resultStr).not.toContain(sensitive)
      }
    })

    it('does not leak values in nested data operations', () => {
      const sensitiveEmail = 'private@secret.email'
      const sensitiveContent = 'confidential content here'

      const query = {
        arguments: {
          data: {
            email: sensitiveEmail,
            posts: {
              create: {
                content: sensitiveContent,
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveEmail)
      expect(resultStr).not.toContain(sensitiveContent)
    })
  })

  describe('filter operators', () => {
    it('does not leak values in filter operators', () => {
      const operators = ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'lt', 'gt', 'lte', 'gte']

      for (const op of operators) {
        for (const sensitive of sensitiveValues) {
          const query = {
            arguments: {
              where: {
                field: { [op]: op === 'in' || op === 'notIn' ? [sensitive] : sensitive },
              },
            },
            selection: { $scalars: true },
          }

          const result = parameterizeQuery(query)
          const resultStr = JSON.stringify(result)
          expect(resultStr).not.toContain(sensitive)
        }
      }
    })

    it('does not leak values in search operator', () => {
      const sensitive = 'secret search term'

      const query = {
        arguments: {
          where: {
            content: { search: sensitive },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitive)
    })

    it('does not leak values in array operators', () => {
      const sensitiveTag = 'secret-tag'

      const operators = ['has', 'hasEvery', 'hasSome']
      for (const op of operators) {
        const query = {
          arguments: {
            where: {
              tags: { [op]: op === 'has' ? sensitiveTag : [sensitiveTag] },
            },
          },
          selection: { $scalars: true },
        }

        const result = parameterizeQuery(query)
        const resultStr = JSON.stringify(result)
        expect(resultStr).not.toContain(sensitiveTag)
      }
    })
  })

  describe('nested relations', () => {
    it('does not leak values in nested relations', () => {
      const sensitive = 'super-secret-value'

      const query = {
        arguments: {
          where: {
            posts: {
              some: {
                content: { contains: sensitive },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitive)
    })

    it('does not leak values in deeply nested relation filters', () => {
      const sensitive1 = 'secret-author-name'
      const sensitive2 = 'secret-comment-content'

      const query = {
        arguments: {
          where: {
            posts: {
              some: {
                author: {
                  name: sensitive1,
                },
                comments: {
                  every: {
                    content: { contains: sensitive2 },
                  },
                },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitive1)
      expect(resultStr).not.toContain(sensitive2)
    })
  })

  describe('tagged values', () => {
    it('does not leak tagged DateTime values', () => {
      const dateValue = '2024-12-25T10:30:00.000Z'

      const query = {
        arguments: {
          where: {
            scheduledAt: { $type: 'DateTime', value: dateValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(dateValue)
    })

    it('does not leak tagged Decimal values', () => {
      const decimalValue = '99999.99'

      const query = {
        arguments: {
          where: {
            salary: { $type: 'Decimal', value: decimalValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(decimalValue)
    })

    it('does not leak tagged BigInt values', () => {
      const bigIntValue = '9007199254740993'

      const query = {
        arguments: {
          where: {
            bigNumber: { $type: 'BigInt', value: bigIntValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(bigIntValue)
    })

    it('does not leak tagged Bytes values', () => {
      const bytesValue = 'U2VjcmV0RGF0YQ=='

      const query = {
        arguments: {
          where: {
            fileData: { $type: 'Bytes', value: bytesValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(bytesValue)
    })

    it('does not leak tagged Json values', () => {
      const jsonValue = '{"secret":"dummy-api-key-NOTREAL"}'

      const query = {
        arguments: {
          where: {
            metadata: { $type: 'Json', value: jsonValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(jsonValue)
      expect(resultStr).not.toContain('dummy-api-key-NOTREAL')
    })

    it('does not leak tagged Enum values', () => {
      const enumValue = 'SECRET_STATUS'

      const query = {
        arguments: {
          where: {
            status: { $type: 'Enum', value: enumValue },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(enumValue)
    })
  })

  describe('logical operators', () => {
    it('does not leak values in deeply nested AND/OR conditions', () => {
      const sensitiveEmail = 'private@secret.com'
      const sensitivePassword = 'p@ssw0rd!'
      const sensitiveRecoveryCode = 'backup-123'

      const query = {
        arguments: {
          where: {
            AND: [
              { email: sensitiveEmail },
              {
                OR: [{ password: sensitivePassword }, { recoveryCode: sensitiveRecoveryCode }],
              },
            ],
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveEmail)
      expect(resultStr).not.toContain(sensitivePassword)
      expect(resultStr).not.toContain(sensitiveRecoveryCode)
    })

    it('does not leak values in NOT conditions', () => {
      const sensitive = 'excluded-secret'

      const query = {
        arguments: {
          where: {
            NOT: {
              secretField: sensitive,
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitive)
    })
  })

  describe('cursor pagination', () => {
    it('does not leak cursor ID values', () => {
      const sensitiveId = 'user_abc123xyz'

      const query = {
        arguments: {
          cursor: { id: sensitiveId },
          take: 10,
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveId)
    })

    it('does not leak compound cursor values', () => {
      const sensitiveEmail = 'cursor@secret.com'
      const sensitiveTenant = 'tenant-secret-123'

      const query = {
        arguments: {
          cursor: {
            email_tenantId: {
              email: sensitiveEmail,
              tenantId: sensitiveTenant,
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveEmail)
      expect(resultStr).not.toContain(sensitiveTenant)
    })
  })

  describe('JSON operators', () => {
    it('does not leak values in JSON path queries', () => {
      const sensitivePath1 = 'secretField'
      const sensitivePath2 = 'nestedSecret'
      const sensitiveValue = 'secret-json-value'

      const query = {
        arguments: {
          where: {
            metadata: {
              path: [sensitivePath1, sensitivePath2],
              equals: sensitiveValue,
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitivePath1)
      expect(resultStr).not.toContain(sensitivePath2)
      expect(resultStr).not.toContain(sensitiveValue)
    })

    it('does not leak values in JSON string operators', () => {
      const sensitiveSearch = 'confidential-content'

      const operators = ['string_contains', 'string_starts_with', 'string_ends_with']
      for (const op of operators) {
        const query = {
          arguments: {
            where: {
              jsonField: { [op]: sensitiveSearch },
            },
          },
          selection: { $scalars: true },
        }

        const result = parameterizeQuery(query)
        const resultStr = JSON.stringify(result)
        expect(resultStr).not.toContain(sensitiveSearch)
      }
    })

    it('does not leak values in JSON array operators', () => {
      const sensitiveElement = 'secret-array-element'

      const operators = ['array_contains', 'array_starts_with', 'array_ends_with']
      for (const op of operators) {
        const query = {
          arguments: {
            where: {
              jsonField: { [op]: sensitiveElement },
            },
          },
          selection: { $scalars: true },
        }

        const result = parameterizeQuery(query)
        const resultStr = JSON.stringify(result)
        expect(resultStr).not.toContain(sensitiveElement)
      }
    })
  })

  describe('connect/disconnect operations', () => {
    it('does not leak IDs in connect operations', () => {
      const sensitiveId1 = 'secret-id-111'
      const sensitiveId2 = 'secret-id-222'

      const query = {
        arguments: {
          data: {
            tags: {
              connect: [{ id: sensitiveId1 }, { id: sensitiveId2 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveId1)
      expect(resultStr).not.toContain(sensitiveId2)
    })

    it('does not leak IDs in connectOrCreate operations', () => {
      const sensitiveId = 'secret-connect-or-create-id'
      const sensitiveEmail = 'connectorcreate@secret.com'

      const query = {
        arguments: {
          data: {
            profile: {
              connectOrCreate: {
                where: { id: sensitiveId },
                create: { email: sensitiveEmail },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain(sensitiveId)
      expect(resultStr).not.toContain(sensitiveEmail)
    })
  })

  describe('combined sensitive data', () => {
    it('does not leak any values in a complex real-world query', () => {
      const sensitiveData = {
        email: 'john.doe@privatecompany.com',
        password: 'SuperSecret123!',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        apiKey: 'placeholder_api_key_NOTREAL',
        internalId: 'usr_2024_confidential',
        salary: '150000.00',
        birthDate: '1990-05-15T00:00:00Z',
      }

      const query = {
        arguments: {
          where: {
            OR: [{ email: sensitiveData.email }, { ssn: sensitiveData.ssn }],
            AND: [
              { apiKey: { equals: sensitiveData.apiKey } },
              {
                payments: {
                  some: {
                    cardNumber: { contains: sensitiveData.creditCard },
                  },
                },
              },
            ],
          },
          data: {
            password: sensitiveData.password,
            salary: { $type: 'Decimal', value: sensitiveData.salary },
            birthDate: { $type: 'DateTime', value: sensitiveData.birthDate },
            profile: {
              update: {
                internalId: sensitiveData.internalId,
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      const result = parameterizeQuery(query)
      const resultStr = JSON.stringify(result)

      for (const [key, value] of Object.entries(sensitiveData)) {
        expect(resultStr, `should not contain ${key}`).not.toContain(value)
      }
    })
  })
})
