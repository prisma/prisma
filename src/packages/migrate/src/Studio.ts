import Debug from '@prisma/debug'
import fs from 'fs'
import getPort from 'get-port'
import path from 'path'
import open from 'open'

import { getSchemaPathSync } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'
import { ProviderAliases } from '@prisma/sdk'

export interface StudioOptions {
  schemaPath?: string
  browser?: string
  port?: number
  staticAssetDir?: string
}

const debug = Debug('Studio')
const packageJson = eval(`require('../package.json')`) // tslint:disable-line

export class Studio {
  private schemaPath: string
  private browser?: string
  private instance?: any
  private port?: number
  private staticAssetDir?: string

  constructor({
    schemaPath,
    browser,
    port,
    staticAssetDir,
  }: StudioOptions = {}) {
    this.schemaPath = this.getSchemaPath(schemaPath)
    this.browser = browser
    this.port = port
    this.staticAssetDir = staticAssetDir || path.resolve(__dirname, 'public') // Overriding this directory since after NCC compilation, this won't resolve automatically
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
        eval(
          `require('path').join(__dirname, '../node_modules/@prisma/sdk/query-engine-${platform}${extension}')`,
        ), // for local dev
        // tslint:disable-next-line
        eval(
          `require('path').join(__dirname, '../query-engine-${platform}${extension}')`,
        ), // for production
      ]

      const pathsExist = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/require-await
        pathCandidates.map(async (candidate) => ({
          exists: fs.existsSync(candidate),
          path: candidate,
        })),
      )

      const firstExistingPath = pathsExist.find((p) => p.exists)

      if (!firstExistingPath) {
        throw new Error(
          `Could not find any Prisma query-engine binary for Studio. Looked in ${pathCandidates.join(
            ', ',
          )}`,
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
        staticAssetDir: this.staticAssetDir,
        versions: {
          prisma2: packageJson.version,
          queryEngine: packageJson.prisma.version,
        },
      })

      await this.instance.start()

      const serverUrl = `http://localhost:${this.port}`
      switch (this.browser) {
        case 'none':
        case 'NONE':
          break
        default:
          await open(serverUrl, {
            app: this.browser,
            url: true,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
          }).catch(() => {}) // Ignore any errors
          break
      }

      return `Studio started at ${serverUrl}`
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

  public async stop(): Promise<void> {
    if (!this.instance) {
      return
    }

    await this.instance.stop('Stopping')
  }

  private getSchemaPath(schemaPathFromOptions?: string): string {
    const schemaPath = getSchemaPathSync(schemaPathFromOptions)
    if (!schemaPath) {
      throw new Error(
        `Could not find ${schemaPathFromOptions || 'schema.prisma'}`,
      )
    }

    return schemaPath
  }
}
