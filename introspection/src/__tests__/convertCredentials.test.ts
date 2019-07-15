import { uriToCredentials, credentialsToUri } from '../convertCredentials'

const uris = [
  'postgresql://',
  'postgresql://localhost',
  'postgresql://localhost:5433',
  'postgresql://localhost/mydb',
  'postgresql://user@localhost',
  'postgresql://user:secret@localhost',
  'postgresql://other@localhost/otherdb?schema=my_schema&connect_timeout=10&application_name=myapp',
  'mysql://user@localhost:3333',
  'mysql://user@localhost:3333/dbname',
  'mongodb://mongodb0.example.com:27017/admin',
  'mongodb://myDBReader:D1fficultP%40ssw0rd@mongodb0.example.com:27017/admin',
]

for (const uri of uris) {
  test(`Convert ${uri}`, () => {
    expect({ before: uri, after: credentialsToUri(uriToCredentials(uri)) }).toMatchSnapshot()
  })
}
