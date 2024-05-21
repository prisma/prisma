import { getSocketFromDatabaseCredentials } from '../../utils/unixSocket'

describe('utils', () => {
  describe('unixSocket', () => {
    it('detects absolute paths', () => {
      expect(
        getSocketFromDatabaseCredentials({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          socket: '/var/run/my-instance.sock',
        }),
      ).toBe('/var/run/my-instance.sock')
    })

    it('detects relative paths', () => {
      expect(
        getSocketFromDatabaseCredentials({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          socket: './my-instance.sock',
        }),
      ).toBe('./my-instance.sock')

      expect(
        getSocketFromDatabaseCredentials({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          socket: '../my-instance.sock',
        }),
      ).toBe('../my-instance.sock')
    })

    it('detects a socket path provided as host for postresql', () => {
      expect(
        getSocketFromDatabaseCredentials({
          type: 'postgresql',
          host: '/var/run/my-instance.sock',
        }),
      ).toBe('/var/run/my-instance.sock')
    })

    it('does not confuse a host as a socket', () => {
      expect(
        getSocketFromDatabaseCredentials({
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
        }),
      ).toBe(null)

      expect(
        getSocketFromDatabaseCredentials({
          type: 'postgresql',
          host: 'my.very_long.domain-001.name',
          port: 5432,
        }),
      ).toBe(null)

      expect(
        getSocketFromDatabaseCredentials({
          type: 'postgresql',
          host: '111.222.333.444',
          port: 5432,
        }),
      ).toBe(null)

      expect(
        getSocketFromDatabaseCredentials({
          type: 'postgresql',
          host: '0000:1111:2222:3333:4444:5555:6666:7777',
          port: 5432,
        }),
      ).toBe(null)
    })
  })
})
