import { credentialsToUri, safeProtocolToConnectorType, uriToCredentials } from '../convertCredentials'

const uris = [
  'file:',
  'file:dev.db',
  'file:/absolute-dev.db',
  'file:./current-dev.db',
  'file:../parent-dev.db',
  'file:../../parent-parent-dev.db',
  'postgresql://localhost:5433?schema=production',
  'postgresql://other@localhost/otherdb?schema=my_schema&connect_timeout=10&application_name=myapp',
  'mysql://user:password@localhost:3333',
  'mysql://user@localhost:3333',
  'mysql://user@localhost:3333/dbname',
  'mysql://user@localhost:3333/dbname?sslmode=prefer',
  'mongodb://mongodb0.example.com:27017/admin',
  'mongodb://myDBReader:D1fficultP%40ssw0rd@mongodb0.example.com:27017/admin',
]

for (const uri of uris) {
  test(`Convert ${uri}`, () => {
    const credentials = uriToCredentials(uri)
    const uriFromCredentials = credentialsToUri(credentials)

    expect(credentials).toMatchSnapshot()
    expect(uriFromCredentials).toMatchSnapshot()

    expect(uriFromCredentials).toBe(uri)
  })
}

// Because we add ?schema=public for default
const notIdenticalUris = [
  'postgresql://',
  'postgresql://localhost',
  'postgresql://localhost:5433',
  'postgresql://localhost/mydb',
  'postgresql://user@localhost',
  'postgresql://user:secret@localhost',
  'postgresql://user:secret@localhost?sslmode=prefer',
  'postgresql://root:prisma@localhost/prisma?host=/var/run/postgresql/',
  'mysql://root@localhost/db?socket=/private/tmp/mysql.sock',
  'mysql://user:specialatchar@password@localhost:3333',
]

for (const uri of notIdenticalUris) {
  test(`Convert ${uri}`, () => {
    const credentials = uriToCredentials(uri)
    const uriFromCredentials = credentialsToUri(credentials)

    expect(credentials).toMatchSnapshot()
    expect(uriFromCredentials).toMatchSnapshot()
  })
}

describe('safeProtocolToConnectorType', () => {
  test('sqlite', () => {
    expect(safeProtocolToConnectorType('file:')).toEqual('sqlite')
    expect(safeProtocolToConnectorType('sqlite:')).toEqual('sqlite')
  })

  test('mongodb', () => {
    expect(safeProtocolToConnectorType('mongodb:')).toEqual('mongodb')
  })

  test('postgresql', () => {
    expect(safeProtocolToConnectorType('postgres:')).toEqual('postgresql')
    expect(safeProtocolToConnectorType('postgresql:')).toEqual('postgresql')
  })

  test('mysql', () => {
    expect(safeProtocolToConnectorType('mysql:')).toEqual('mysql')
  })

  test('sqlserver', () => {
    expect(safeProtocolToConnectorType('sqlserver:')).toEqual('sqlserver')
    expect(safeProtocolToConnectorType('jdbc:sqlserver:')).toEqual('sqlserver')
  })

  test('unsupported', () => {
    expect(safeProtocolToConnectorType('unsupported:')).toEqual(undefined)
  })
})
