import { Command, getCommandWithExecutor, isError } from '@prisma/internals'
import { green } from 'kleur/colors'

import { deleteAuthConfig, readAuthConfig, successMessage } from '../../utils/platform'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse() {
    const authJson = await readAuthConfig()
    if (isError(authJson)) throw authJson
    if (!authJson.token) {
      return `You are not currently logged in. Run ${green(
        getCommandWithExecutor('prisma platform auth login --early-access'),
      )} to log in.`
    }
    await deleteAuthConfig()
    // TODO: Add oauth logout
    return successMessage('You have logged out')
  }
}
