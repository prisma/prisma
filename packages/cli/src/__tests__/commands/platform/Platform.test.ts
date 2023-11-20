import { isError } from '@prisma/internals'

import { PlatformCommand } from '../../../platform/PlatformCommand'

describe('--early-access-feature flag', () => {
  it('should not work without it', async () => {
    const result = await PlatformCommand.new().parse([])
    const resultIsError = isError(result)
    expect(resultIsError).toBeTruthy()
    if (resultIsError) {
      expect(result.message).toMatch('This feature is currently in Early Access.')
    }
  })
  it('should work with it', async () => {
    const result = await PlatformCommand.new().parse(['--early-access-feature'])
    const resultIsError = isError(result)
    expect(resultIsError).toBeFalsy()
    expect(result).toBe('')
  })
})
