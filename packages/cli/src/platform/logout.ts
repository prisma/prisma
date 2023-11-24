import { Command } from '@prisma/internals'

import { deleteAuthConfig, readAuthConfig } from '../utils/platform'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse() {
    const { token } = await readAuthConfig()
    if (!token) {
      return 'You are not logged in.'
    }
    await deleteAuthConfig()
    // TODO: Add oauth logout
    return 'Logged out!'
  }
}
