import url from 'node:url'

import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { EngineType, generatorHandler } from '@prisma/generator-helper'
import { ClientEngineType, getClientEngineType, parseEnvValue } from '@prisma/internals'
import { match } from 'ts-pattern'

import { version as clientVersion } from '../../../package.json'

const debug = Debug('prisma:client:generator')

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  generatorHandler({
    onManifest(config) {
      const requiresEngines = match<ClientEngineType, EngineType[]>(getClientEngineType(config))
        .with(ClientEngineType.Library, () => ['libqueryEngine'])
        .with(ClientEngineType.Binary, () => ['queryEngine'])
        .with(ClientEngineType.Client, () => [])
        .exhaustive()

      debug('requiresEngines', requiresEngines)

      return {
        prettyName: 'Prisma Client',
        requiresEngines,
        version: clientVersion,
        requiresEngineVersion: enginesVersion,
      }
    },

    onGenerate(options) {
      if (!options.generator.output) {
        throw new Error('Output directory is required')
      }

      const outputDir = parseEnvValue(options.generator.output)

      throw new Error(`Not implemented yet. Would generate in ${outputDir}.`)
    },
  })
}
