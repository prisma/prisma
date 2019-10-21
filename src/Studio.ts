import debugLib from 'debug'
import fs from 'fs'
import getPort from 'get-port'
import path from 'path'

import { getSchemaDirSync } from '@prisma/cli'
import { getPlatform } from '@prisma/get-platform'

import { getDatamodelPath } from './utils/getDatamodelPath'

export interface StudioOptions {
  projectDir?: string
  port?: number
}

const debug = debugLib('Studio')
const packageJson = eval(`require('../package.json')`) // tslint:disable-line

export class Studio {
  private projectDir: string
  private instance?: any
  private port?: number

  constructor({ projectDir, port }: StudioOptions = {}) {
    this.projectDir = projectDir || this.getSchemaDir()
    this.port = port
  }

  public async start(providerAliases: { [key: string]: string }): Promise<string> {
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

      let photonWorkerPath: string | undefined
      try {
        const studioTransport = require.resolve('@prisma/studio-transports')
        photonWorkerPath = path.join(path.dirname(studioTransport), 'photon-worker.js')
      } catch (e) {
        //
      }

      this.port = await getPort({ port: getPort.makeRange(5555, 5600) })
      this.instance = new StudioServer({
        port: this.port,
        debug: false,
        binaryPath: firstExistingPath.path,
        photonWorkerPath,
        photonGenerator: {
          version: packageJson.prisma.version,
          providerAliases,
        },
        schemaPath: getDatamodelPath(this.projectDir),
      })

      await this.instance.start()

      return `Studio started at http://localhost:${this.port}`
    } catch (e) {
      debug(e)
    }

    return ''
  }

  public async restart(providerAliases: { [key: string]: string }) {
    if (this.instance) {
      this.instance.restart()
      return ''
    }

    return this.start(providerAliases)
  }

  private getSchemaDir(): string {
    const schemaPath = getSchemaDirSync()
    if (!schemaPath) {
      throw new Error(`Could not find schema.prisma`)
    }

    return schemaPath
  }
}
