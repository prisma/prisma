import { credentialsFile } from '../../_lib/credentials'
import { requestOrThrow } from '../../_lib/pdp'
import { Show } from '../show'

jest.mock('../../_lib/pdp')

describe('platform auth show', () => {
  test('should output token with --sensitive', async () => {
    jest.mocked(requestOrThrow).mockImplementation(
      (): Promise<{
        me: {
          user: {
            __typename: string
            id: string
            email: string
            displayName: string
          }
        }
      }> =>
        Promise.resolve({
          me: {
            user: {
              __typename: 'User',
              id: '23',
              email: 'foo@bar.org',
              displayName: 'Foo Bar',
            },
          },
        }),
    )

    jest.spyOn(credentialsFile, 'load').mockImplementation(
      (): ReturnType<typeof credentialsFile.load> =>
        Promise.resolve({
          token: 'testToken',
        }),
    )

    await expect(Show.new().parse(['--sensitive'])).resolves.toContain('testToken')
  })

  test('should not output token if --sensitive not given', async () => {
    jest.mocked(requestOrThrow).mockImplementation(
      (): Promise<{
        me: {
          user: {
            __typename: string
            id: string
            email: string
            displayName: string
          }
        }
      }> =>
        Promise.resolve({
          me: {
            user: {
              __typename: 'User',
              id: '23',
              email: 'foo@bar.org',
              displayName: 'Foo Bar',
            },
          },
        }),
    )

    jest.spyOn(credentialsFile, 'load').mockImplementation(
      (): ReturnType<typeof credentialsFile.load> =>
        Promise.resolve({
          token: 'testToken',
        }),
    )

    await expect(Show.new().parse([])).resolves.not.toContain('testToken')
  })
})
