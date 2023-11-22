import { isError } from '@prisma/internals'

import { $ } from '../../../platform/$'

describe('--early-access-feature flag', () => {
  it('should not work without it', () => {
    // eslint-disable-next-line
    expect($.new({}).parse([])).rejects.toMatchInlineSnapshot(`
      This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
      Please provide the --early-access-feature flag to use this command.
    `)
  })
  it('should work with it', async () => {
    const result = await $.new({}).parse(['--early-access-feature'])
    const resultIsError = isError(result)
    expect(resultIsError).toBeFalsy()
    expect(result).toBe('""')
  })
})
