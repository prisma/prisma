import { isError } from '@prisma/internals'

import { PlatformCommand } from '../../../platform/PlatformCommand'

describe('using cli', () => {
  it('should not work without the --early-access-feature flag', async () => {
    console.log(1)
    const result = await PlatformCommand.new().parse([])
    const resultIsError = isError(result)
    expect(resultIsError).toBeTruthy()
    if (resultIsError) {
      expect(result.message).toMatch('This feature is currently in Early Access.')
    }
  })
})
