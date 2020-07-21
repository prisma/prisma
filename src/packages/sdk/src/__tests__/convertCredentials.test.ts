import { uriToCredentials, credentialsToUri } from '../convertCredentials'

const uris = [
  'file:',
  'file:dev.db',
  'file:/absolute-dev.db',
  'file:./current-dev.db',
  'file:../parent-dev.db',
  'file:../../parent-parent-dev.db',
  'sqlite:',
  'sqlite:dev.db',
  'sqlite:/absolute-dev.db',
  'sqlite:./current-dev.db',
  'sqlite:../parent-dev.db',
  'sqlite:../../parent-parent-dev.db',
  'sqlite://',
  'sqlite://dev.db',
  'postgresql://',
  'postgresql://localhost',
  'postgresql://localhost:5433',
  'postgresql://localhost/mydb',
  'postgresql://user@localhost',
  'postgresql://user:secret@localhost',
  'postgresql://user:secret@localhost?sslmode=prefer',
  'postgresql://other@localhost/otherdb?schema=my_schema&connect_timeout=10&application_name=myapp',
  'mysql://user@localhost:3333',
  'mysql://user@localhost:3333/dbname',
  'mysql://user@localhost:3333/dbname?sslmode=prefer',
  'mongodb://mongodb0.example.com:27017/admin',
  'mongodb://myDBReader:D1fficultP%40ssw0rd@mongodb0.example.com:27017/admin',
  'mysql://root@/db?socket=/private/tmp/mysql.sock',
  'postgresql://root:prisma@/prisma?host=/var/run/postgresql/',
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
