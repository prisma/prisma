import { Command, isError } from '@prisma/internals'

import { deleteAuthConfig, readAuthConfig } from '../utils/platform'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse() {
    const authJson = await readAuthConfig()
    if (isError(authJson)) throw authJson
    if (!authJson.token) {
      return 'You are not logged in.'
    }
    await deleteAuthConfig()
    // TODO: Add oauth logout
    return 'Logged out!'
  }
}
