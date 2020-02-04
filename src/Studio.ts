import debugLib from 'debug'
import fs from 'fs'
import getPort from 'get-port'
import path from 'path'

import { getSchemaPathSync } from '@prisma/cli'
import { getPlatform } from '@prisma/get-platform'
import { ProviderAliases } from '@prisma/sdk'

export interface StudioOptions {
  schemaPath?: string
  port?: number
}

const debug = debugLib('Studio')
const packageJson = eval(`require('../package.json')`) // tslint:disable-line

export class Studio {
  private schemaPath: string
  private instance?: any
  private port?: number

  constructor({ schemaPath, port }: StudioOptions = {}) {
    this.schemaPath = this.getSchemaPath(schemaPath)
    this.port = port
  }

  public async start(providerAliases: ProviderAliases): Promise<string> {
    try {
      if (this.instance) {
        throw new Error(`Studio is already started`)
      }

      const platform = await getPlatform()
      const extension = platform === 'windows' ? '.exe' : ''

      const pathCandidates = [
        // ncc go home
        // tslint:disable-next-line
        eval(`require('path').join(__dirname, '../node_modules/@prisma/sdk/query-engine-${platform}${extension}')`), // for local dev
        // tslint:disable-next-line
        eval(`require('path').join(__dirname, '../query-engine-${platform}${extension}')`), // for production
      ]

      const pathsExist = await Promise.all(
        pathCandidates.map(async candidate => ({ exists: fs.existsSync(candidate), path: candidate })),
      )

      const firstExistingPath = pathsExist.find(p => p.exists)

      if (!firstExistingPath) {
        throw new Error(
          `Could not find any Prisma2 query-engine binary for Studio. Looked in ${pathCandidates.join(', ')}`,
        )
      }

      const StudioServer = (await import('@prisma/studio-server')).default

      if (!this.port) {
        this.port = await getPort({ port: getPort.makeRange(5555, 5600) })
      }

      this.instance = new StudioServer({
        port: this.port,
        schemaPath: this.schemaPath,
        binaryPaths: {
          queryEngine: firstExistingPath.path,
        },
        prismaClient: {
          generator: {
            version: packageJson.prisma.version,
            providerAliases,
          },
        },
        staticAssetDir: path.resolve(__dirname, 'public'), // Overriding this directory since after NCC compilation, this won't resolve automatically
        versions: {
          prisma2: packageJson.version,
          queryEngine: packageJson.prisma.version,
        },
      })

      await this.instance.start()

      return `Studio started at http://localhost:${this.port}`
    } catch (e) {
      debug(e)
    }

    return ''
  }

  public async restart(providerAliases: ProviderAliases): Promise<string> {
    if (this.instance) {
      await this.instance.stop('Restarting')
      await this.instance.start(providerAliases)
      return ''
    }

    return this.start(providerAliases)
  }

  private getSchemaPath(schemaPathFromOptions?): string {
    const schemaPath = getSchemaPathSync(schemaPathFromOptions)
    if (!schemaPath) {
      throw new Error(`Could not find schema.prisma`)
    }

    return schemaPath
  }
}
