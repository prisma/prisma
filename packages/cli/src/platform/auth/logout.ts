import { Command, getCommandWithExecutor, isError } from '@prisma/internals'
import { green } from 'kleur/colors'

import { credentialsFile } from '../lib/credentials'
import { successMessage } from '../lib/utils'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse() {
    const credentials = await credentialsFile.load()
    if (isError(credentials)) throw credentials
    if (!credentials) return `You are not currently logged in. Run ${green(getCommandWithExecutor('prisma platform auth login --early-access'))} to log in.` // prettier-ignore
    await credentialsFile.delete()
    // TODO: Add oauth logout
    return successMessage('You have logged out')
  }
}
