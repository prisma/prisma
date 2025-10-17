import { defaultTestConfig } from '@prisma/config'
import { vi } from 'vitest'

import { requestOrThrow } from '../../_lib/pdp'
import { getTokenOrThrow } from '../../_lib/utils'
import { Show } from '../show'

vi.mock('../../_lib/pdp')
vi.mock('../../_lib/utils')

describe('platform auth show', () => {
  test('should output token with --sensitive', async () => {
    vi.mocked(requestOrThrow).mockResolvedValue(
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

    vi.mocked(getTokenOrThrow).mockReturnValue(Promise.resolve('testToken'))

    await expect(Show.new().parse(['--sensitive'], defaultTestConfig())).resolves.toContain('testToken')
  })
  test('should not output token if --sensitive not given', async () => {
    vi.mocked(requestOrThrow).mockResolvedValue(
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

    vi.mocked(getTokenOrThrow).mockReturnValue(Promise.resolve('testToken'))

    await expect(Show.new().parse([], defaultTestConfig())).resolves.not.toContain('testToken')
  })
})
