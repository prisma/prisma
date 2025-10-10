import { describe, expect, it } from 'vitest'

import { extractSchemaFromConnectionString, parseConnectionString } from './connection-string'

describe('parseConnectionString', () => {
  describe('basic connection parameters', () => {
    it('should parse a basic connection string correctly', () => {
      const connectionString = 'sqlserver://localhost:1433;database=testdb;user=sa;password=mypassword;encrypt=true'
      const config = parseConnectionString(connectionString)

      expect(config.server).toBe('localhost')
      expect(config.port).toBe(1433)
      expect(config.database).toBe('testdb')
      expect(config.user).toBe('sa')
      expect(config.password).toBe('mypassword')
      expect(config.options?.encrypt).toBe(true)
    })

    it('should parse connection string without port', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;user=sa;password=mypassword'
      const config = parseConnectionString(connectionString)

      expect(config.server).toBe('localhost')
      expect(config.port).toBeUndefined()
      expect(config.database).toBe('testdb')
      expect(config.user).toBe('sa')
      expect(config.password).toBe('mypassword')
    })

    it('should handle different user parameter names', () => {
      const testCases = [
        'sqlserver://localhost;database=testdb;user=sa;password=mypassword',
        'sqlserver://localhost;database=testdb;username=sa;password=mypassword',
        'sqlserver://localhost;database=testdb;uid=sa;password=mypassword',
        'sqlserver://localhost;database=testdb;userid=sa;password=mypassword',
      ]

      testCases.forEach((connectionString) => {
        const config = parseConnectionString(connectionString)
        expect(config.user).toBe('sa')
      })
    })

    it('should handle different password parameter names', () => {
      const testCases = [
        'sqlserver://localhost;database=testdb;user=sa;password=mypassword',
        'sqlserver://localhost;database=testdb;user=sa;pwd=mypassword',
      ]

      testCases.forEach((connectionString) => {
        const config = parseConnectionString(connectionString)
        expect(config.password).toBe('mypassword')
      })
    })

    it('should handle different database parameter names', () => {
      const testCases = [
        'sqlserver://localhost;database=testdb;user=sa;password=mypassword',
        'sqlserver://localhost;initial catalog=testdb;user=sa;password=mypassword',
      ]

      testCases.forEach((connectionString) => {
        const config = parseConnectionString(connectionString)
        expect(config.database).toBe('testdb')
      })
    })
  })

  describe('encryption parameters', () => {
    it('should parse encrypt parameter correctly', () => {
      const testCases = [
        { input: 'sqlserver://localhost;database=testdb;encrypt=true', expected: true },
        { input: 'sqlserver://localhost;database=testdb;encrypt=false', expected: false },
      ]

      testCases.forEach(({ input, expected }) => {
        const config = parseConnectionString(input)
        expect(config.options?.encrypt).toBe(expected)
      })
    })

    it('should parse trustServerCertificate parameter correctly', () => {
      const testCases = [
        { input: 'sqlserver://localhost;database=testdb;trustServerCertificate=true', expected: true },
        { input: 'sqlserver://localhost;database=testdb;trustServerCertificate=false', expected: false },
      ]

      testCases.forEach(({ input, expected }) => {
        const config = parseConnectionString(input)
        expect(config.options?.trustServerCertificate).toBe(expected)
      })
    })

    it('should handle both encryption parameters together', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;encrypt=true;trustServerCertificate=true'
      const config = parseConnectionString(connectionString)

      expect(config.options?.encrypt).toBe(true)
      expect(config.options?.trustServerCertificate).toBe(true)
    })
  })

  it.each([
    { input: 'sqlserver://localhost;database=testdb;multiSubnetFailover=true', expected: true },
    { input: 'sqlserver://localhost;database=testdb;multiSubnetFailover=false', expected: false },
  ])('should parse multiSubnetFailover parameter correctly for %o', ({ input, expected }) => {
    const config = parseConnectionString(input)
    expect(config.options?.multiSubnetFailover).toBe(expected)
  })

  describe('connection pool parameters', () => {
    it('should parse connectionLimit parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectionLimit=10'
      const config = parseConnectionString(connectionString)

      expect(config.pool?.max).toBe(10)
    })

    it('should parse poolTimeout parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;poolTimeout=15'
      const config = parseConnectionString(connectionString)

      expect(config.pool?.acquireTimeoutMillis).toBe(15000) // 15 seconds in milliseconds
    })
  })

  describe('timeout parameters', () => {
    it('should parse connectTimeout parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectTimeout=30'
      const config = parseConnectionString(connectionString)

      expect(config.connectionTimeout).toBe(30)
    })

    it('should parse connectionTimeout parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectionTimeout=30'
      const config = parseConnectionString(connectionString)

      expect(config.connectionTimeout).toBe(30)
    })

    it('should parse loginTimeout parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;loginTimeout=45'
      const config = parseConnectionString(connectionString)

      expect(config.connectionTimeout).toBe(45)
    })

    it('should parse socketTimeout parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;socketTimeout=60'
      const config = parseConnectionString(connectionString)

      expect(config.requestTimeout).toBe(60)
    })

    it('should handle multiple timeout parameters', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectTimeout=30;socketTimeout=60;poolTimeout=10'
      const config = parseConnectionString(connectionString)

      expect(config.connectionTimeout).toBe(30)
      expect(config.requestTimeout).toBe(60)
      expect(config.pool?.acquireTimeoutMillis).toBe(10000)
    })
  })

  describe('application name parameter', () => {
    it('should parse applicationName parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;applicationName=MyApp'
      const config = parseConnectionString(connectionString)

      expect(config.options?.appName).toBe('MyApp')
    })

    it('should parse application name parameter correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;application name=MyApp'
      const config = parseConnectionString(connectionString)

      expect(config.options?.appName).toBe('MyApp')
    })
  })

  describe('schema parameter', () => {
    it('should ignore schema parameter', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;schema=custom'
      const config = parseConnectionString(connectionString)

      // Schema should not be in the config, it's handled separately
      // The schema parameter is ignored during parsing
      expect(config.database).toBe('testdb')
    })
  })

  describe('isolation level parameter', () => {
    it('should parse isolationLevel parameter correctly', () => {
      const testCases = [
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=READ COMMITTED', expected: 2 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=READ UNCOMMITTED', expected: 1 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=REPEATABLE READ', expected: 3 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=SERIALIZABLE', expected: 4 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=SNAPSHOT', expected: 5 },
      ]

      testCases.forEach(({ input, expected }) => {
        const config = parseConnectionString(input)
        expect(config.options?.isolationLevel).toBe(expected)
      })
    })

    it('should handle isolation level values without spaces', () => {
      const testCases = [
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=READCOMMITTED', expected: 2 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=READUNCOMMITTED', expected: 1 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=REPEATABLEREAD', expected: 3 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=SERIALIZABLE', expected: 4 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=SNAPSHOT', expected: 5 },
      ]

      testCases.forEach(({ input, expected }) => {
        const config = parseConnectionString(input)
        expect(config.options?.isolationLevel).toBe(expected)
      })
    })

    it('should handle case insensitive isolation level values', () => {
      const testCases = [
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=read committed', expected: 2 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=readcommitted', expected: 2 },
        { input: 'sqlserver://localhost;database=testdb;isolationLevel=ReadCommitted', expected: 2 },
      ]

      testCases.forEach(({ input, expected }) => {
        const config = parseConnectionString(input)
        expect(config.options?.isolationLevel).toBe(expected)
      })
    })
  })

  describe('case sensitivity', () => {
    it('should handle case sensitive parameter names correctly', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;user=sa;password=mypassword;encrypt=true'
      const config = parseConnectionString(connectionString)

      expect(config.database).toBe('testdb')
      expect(config.user).toBe('sa')
      expect(config.password).toBe('mypassword')
      expect(config.options?.encrypt).toBe(true)
    })

    it('should handle case insensitive boolean values', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;encrypt=TRUE;trustServerCertificate=FALSE'
      const config = parseConnectionString(connectionString)

      expect(config.options?.encrypt).toBe(true)
      expect(config.options?.trustServerCertificate).toBe(false)
    })
  })

  describe('whitespace handling', () => {
    it('should handle whitespace around parameters', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;user=sa;password=mypassword'
      const config = parseConnectionString(connectionString)

      expect(config.database).toBe('testdb')
      expect(config.user).toBe('sa')
      expect(config.password).toBe('mypassword')
    })

    it('should handle whitespace around values', () => {
      const connectionString = 'sqlserver://localhost;database= testdb ;user= sa ;password= mypassword '
      const config = parseConnectionString(connectionString)

      expect(config.database).toBe('testdb')
      expect(config.user).toBe('sa')
      expect(config.password).toBe('mypassword')
    })
  })

  describe('unknown parameters', () => {
    it('should ignore unknown parameters without throwing', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;unknownParam=value;anotherUnknown=123'
      const config = parseConnectionString(connectionString)

      expect(config.database).toBe('testdb')
      // Should not throw and should ignore unknown parameters
    })
  })

  describe('error handling', () => {
    it('should throw error for invalid port', () => {
      const connectionString = 'sqlserver://localhost:invalid;database=testdb'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid port number: invalid')
    })

    it('should throw error for invalid connection limit', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectionLimit=invalid'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid connection limit: invalid')
    })

    it('should throw error for invalid connection timeout', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;connectTimeout=invalid'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid connection timeout: invalid')
    })

    it('should throw error for invalid login timeout', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;loginTimeout=invalid'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid login timeout: invalid')
    })

    it('should throw error for invalid socket timeout', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;socketTimeout=invalid'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid socket timeout: invalid')
    })

    it('should throw error for invalid pool timeout', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;poolTimeout=invalid'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid pool timeout: invalid')
    })

    it('should throw error for invalid isolation level', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;isolationLevel=INVALID'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Invalid isolation level: INVALID')
    })

    it('should throw error for missing server', () => {
      const connectionString = 'sqlserver://;database=testdb'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Server host is required in connection string')
    })

    it('should throw error for empty server', () => {
      const connectionString = 'sqlserver:// :1433;database=testdb'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Server host is required in connection string')
    })

    it('should throw error for malformed connection string', () => {
      const connectionString = 'sqlserver://'

      expect(() => {
        parseConnectionString(connectionString)
      }).toThrow('Server host is required in connection string')
    })
  })

  describe('edge cases', () => {
    it('should handle connection string with only server', () => {
      const connectionString = 'sqlserver://localhost'
      const config = parseConnectionString(connectionString)

      expect(config.server).toBe('localhost')
      expect(config.database).toBeUndefined()
      expect(config.user).toBeUndefined()
      expect(config.password).toBeUndefined()
    })

    it('should handle connection string with empty values', () => {
      const connectionString = 'sqlserver://localhost;database=;user=;password='
      const config = parseConnectionString(connectionString)

      expect(config.server).toBe('localhost')
      expect(config.database).toBe('')
      expect(config.user).toBe('')
      expect(config.password).toBe('')
    })

    it('should handle connection string with malformed key-value pairs', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;=value;key=;='
      const config = parseConnectionString(connectionString)

      expect(config.server).toBe('localhost')
      expect(config.database).toBe('testdb')
      // Should ignore malformed pairs
    })
  })

  describe('authentication parameters', () => {
    it.each([
      'sqlserver://localhost:1433;database=testdb;authentication=DefaultAzureCredential',
      'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryIntegrated',
      'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryInteractive',
    ])('should support authentication parameter for %s', (connectionString) => {
      const config = parseConnectionString(connectionString)
      expect(config.user).toBe(undefined)
      expect(config.password).toBe(undefined)
      expect(config.authentication?.type).toBe('azure-active-directory-default')
    })

    it('should support authentication password parameters', () => {
      const connectionString =
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryPassword;userName=user1;password=mypassword;clientId=my-client-id'
      const config = parseConnectionString(connectionString)

      expect(config.authentication?.type).toBe('azure-active-directory-password')
      if (config.authentication?.type === 'azure-active-directory-password') {
        expect(config.authentication?.options?.clientId).toBe('my-client-id')
        expect(config.authentication?.options?.userName).toBe('user1')
        expect(config.authentication?.options?.password).toBe('mypassword')
        expect(config.authentication?.options?.tenantId).toBe('')
      } else {
        throw new Error('expected config.authentication.type to be azure-active-directory-password')
      }
    })

    it.each([
      'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryManagedIdentity;clientId=test-client;msiEndpoint=msi-endpoint-1;msiSecret=msi-secret-1',
      'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryMSI;clientId=test-client;msiEndpoint=msi-endpoint-1;msiSecret=msi-secret-1',
    ])('should support authentication managed identity parameters for %s', (connectionString) => {
      const config = parseConnectionString(connectionString)

      expect(config.user).toBe(undefined)
      expect(config.password).toBe(undefined)
      expect(config.authentication?.type).toBe('azure-active-directory-msi-app-service')
      if (config.authentication?.type === 'azure-active-directory-msi-app-service') {
        expect(config.authentication?.options?.clientId).toBe('test-client')
        // @ts-expect-error tedious typings do not include msiEndpoint
        expect(config.authentication?.options?.msiEndpoint).toBe('msi-endpoint-1')
        // @ts-expect-error tedious typings do not include msiSecret
        expect(config.authentication?.options?.msiSecret).toBe('msi-secret-1')
      } else {
        throw new Error('expected config.authentication.type to be azure-active-directory-msi-app-service')
      }
    })

    it('should support authentication service principal parameters', () => {
      const connectionString =
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryServicePrincipal;userName=test-client-id;password=mysecret'
      const config = parseConnectionString(connectionString)

      expect(config.authentication?.type).toBe('azure-active-directory-service-principal-secret')
      if (config.authentication?.type === 'azure-active-directory-service-principal-secret') {
        expect(config.authentication?.options?.clientId).toBe('test-client-id')
        expect(config.authentication?.options?.clientSecret).toBe('mysecret')
        expect(config.authentication?.options?.tenantId).toBe('')
      } else {
        throw new Error('expected config.authentication.type to be azure-active-directory-service-principal-secret')
      }
    })

    describe('error handling', () => {
      it.each([
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryPassword;userName=user1;password=mypassword',
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryPassword;userName=user1;clientId=my-client-id',
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryPassword;password=mypassword;clientId=my-client-id',
      ])('should check authentication password parameters are present for %s', (connectionString) => {
        expect(() => parseConnectionString(connectionString)).toThrow(
          'Invalid authentication, ActiveDirectoryPassword requires userName, password, clientId',
        )
      })

      it.each([
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryManagedIdentity;clientId=test-client;msiSecret=msi-secret-1',
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryManagedIdentity;clientId=test-client;msiEndpoint=msi-endpoint-1;',
      ])('should check authentication managed identity parameters are present for %s', (connectionString) => {
        expect(() => parseConnectionString(connectionString)).toThrow(
          'Invalid authentication, ActiveDirectoryManagedIdentity requires msiEndpoint, msiSecret',
        )
      })

      it.each([
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryServicePrincipal;userName=test-client-id',
        'sqlserver://localhost:1433;database=testdb;authentication=ActiveDirectoryServicePrincipal;password=mysecret',
      ])('should check authentication service principal parameters are present for %s', (connectionString) => {
        expect(() => parseConnectionString(connectionString)).toThrow(
          'Invalid authentication, ActiveDirectoryServicePrincipal requires userName (clientId), password (clientSecret)',
        )
      })
    })
  })
})

describe('extractSchemaFromConnectionString', () => {
  it('should extract schema parameter correctly', () => {
    const connectionString = 'sqlserver://localhost;database=testdb;schema=custom'
    const schema = extractSchemaFromConnectionString(connectionString)

    expect(schema).toBe('custom')
  })

  it('should extract schema parameter without database', () => {
    const connectionString = 'sqlserver://localhost;schema=custom'
    const schema = extractSchemaFromConnectionString(connectionString)

    expect(schema).toBe('custom')
  })

  it('should return undefined when schema is not provided', () => {
    const connectionString = 'sqlserver://localhost;database=testdb'
    const schema = extractSchemaFromConnectionString(connectionString)

    expect(schema).toBeUndefined()
  })

  it('should handle schema parameter with whitespace', () => {
    const connectionString = 'sqlserver://localhost;database=testdb; schema = custom '
    const schema = extractSchemaFromConnectionString(connectionString)

    expect(schema).toBe('custom')
  })

  it('should handle empty schema value', () => {
    const connectionString = 'sqlserver://localhost;database=testdb;schema='
    const schema = extractSchemaFromConnectionString(connectionString)

    expect(schema).toBe('')
  })
})
