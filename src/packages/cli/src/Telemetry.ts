import { Version } from './Version'
import { Command } from '@prisma/sdk'
import * as checkpoint from 'checkpoint-client'
import { getCLIPathHash, getProjectHash } from '@prisma/sdk'

/**
 * $ prisma telemetry
 */
export class Telemetry implements Command {
  public static new(): Telemetry {
    return new Telemetry()
  }

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    const signature = await checkpoint.getSignature()
    const version = JSON.parse(await Version.new().parse(['--json']))
    // SHA256 identifier for the project based on the prisma schema path
    const projectPathHash = await getProjectHash()
    // SHA256 of the cli path
    const cliPathHash = getCLIPathHash()

    return JSON.stringify(
      {
        signature,
        projectPathHash,
        cliPathHash,
        version,
      },
      undefined,
      2,
    )
  }
}
