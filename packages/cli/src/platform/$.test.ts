import { defaultTestConfig } from '@prisma/config'
import { isError } from '@prisma/internals'

import { $ as platform } from './$'

describe('--early-access flag', () => {
  it('should not work without it', () => {
    // eslint-disable-next-line
    expect(platform.new({}).parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
      "This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
      Please provide the --early-access flag to use this command."
    `)
  })

  it('should output help if no subcommand or parameter is passed', async () => {
    const commandInstance = platform.new({})
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')
    const result = await commandInstance.parse(['--early-access'], defaultTestConfig())
    const resultIsError = isError(result)
    expect(resultIsError).toBeFalsy()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('should output help if -h is passed', async () => {
    const commandInstance = platform.new({})
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')
    const result = await commandInstance.parse(['--early-access', '-h'], defaultTestConfig())
    const resultIsError = isError(result)
    expect(resultIsError).toBeFalsy()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('should output the help', async () => {
    const commandInstance = platform.new({})
    const result = await commandInstance.parse(['--early-access'], defaultTestConfig())
    expect(result).toMatchInlineSnapshot(`
      "
      Usage

        $ prisma platform [command] [options]

      Commands

                 auth   Manage authentication with your Prisma Data Platform account
            workspace   Manage workspaces
              project   Manage projects
          environment   Manage environments
               apikey   Manage API keys
           accelerate   Manage Prisma Accelerate
                pulse   Manage Prisma Pulse

      Options

         --early-access    Enable early access features
                --token    Specify a token to use for authentication

      Examples

        $ prisma platform auth login
        $ prisma platform project create --workspace <id>

      For detailed command descriptions and options, use \`prisma platform [command] --help\`
      For additional help visit https://pris.ly/cli/platform-docs
      "
    `)
  })
})
