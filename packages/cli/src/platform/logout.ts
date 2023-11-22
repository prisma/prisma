import { Command } from '@prisma/internals'

import { deleteAuthConfig, readAuthConfig } from '../utils/platform'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse() {
    const { token } = await readAuthConfig()
    console.log('token', token)
    if (!token) {
      console.log('You are not logged in.')
      return ''
    }
    await deleteAuthConfig()
    // TODO: Add oauth logout
    console.log('Logged out!')
    return ``
  }
}
