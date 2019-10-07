import React, { useEffect, useState, useContext } from 'react'
import { Color, Box } from 'ink'
import { useInitState } from '../components/InitState'
import { beautifyLanguage } from '../utils/print'
import DownloadProgress from '../components/DownloadProgress'
import os from 'os'
import path from 'path'
import fetch from 'node-fetch'
import tar from 'tar'
import fs from 'fs'
import execa from 'execa'
import chalk from 'chalk'
import { useExampleApi } from '../utils/useExampleApi'
import { RouterContext } from '../components/Router'
import makeDir from 'make-dir'
import { promisify } from 'util'
import { DataSource } from '@prisma/photon'
import { getProxyAgent } from '@prisma/fetch-engine'
import { DatabaseCredentials } from '../../types'
import { replaceDatasource, replaceGenerator } from '../utils/replaceDatasource'
import { credentialsToUri } from '../../convertCredentials'
import { DatabaseType } from 'prisma-datamodel'
import { ConnectorType } from '@prisma/photon/dist/isdlToDatamodel2'
import { useConnector } from '../components/useConnector'
import { exampleScript } from '../utils/templates/script'
import { ErrorBox } from '@prisma/ink-components'
import { photonDefaultConfig } from '../utils/defaults'
import EmptyDirError from '../components/EmptyDirError'
import Debug from 'debug'
const debug = Debug('download-example')
const debugEnabled = Debug.enabled('download-example')

const readdir = promisify(fs.readdir)

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)

const Step60DownloadExample: React.FC = () => {
  const [state] = useInitState()
  const [activeIndex, setActiveIndex] = useState(0)
  const [logs, setLogs] = useState('')
  const [commandError, setError] = useState('')
  const router = useContext(RouterContext)
  const { introspectionResult } = useConnector()
  const [showEmptyDirError, setShowEmptyDirError] = useState(false)
  const examples = useExampleApi()

  const { selectedExample } = state

  if (!selectedExample) {
    return <Box>No example selected</Box>
  }

  const relativePath = path.relative(process.cwd(), state.outputDir) || './'

  const thingToDownload = state.useDemoScript ? 'demo script' : 'starter kit'
  const builtInSteps = [
    `Downloading the ${thingToDownload} from GitHub`,
    `Extracting content to ${chalk.bold(relativePath)}`,
  ]

  const commandsSlice = introspectionResult ? 1 : selectedExample.setupCommands.length

  const steps = [...builtInSteps, ...selectedExample.setupCommands.map(c => c.description)]

  useEffect(() => {
    async function prepare() {
      if (await exists(state.outputDir)) {
        const files = await readdir(state.outputDir)
        if (files.length > 0) {
          setShowEmptyDirError(true)
          setTimeout(() => {
            process.exit(1)
          })
          return
        }
      }

      // adjust datasource in schema
      const schemaPath = path.join(state.outputDir, 'prisma/schema.prisma')

      async function getReplacementSchema() {
        const schema = await readFile(schemaPath, 'utf-8')
        const datasource = credentialsToDataSource(state.dbCredentials!)
        return replaceDatasource(schema, datasource)
      }

      try {
        if (!state.dbCredentials) {
          throw new Error(`No db credentials - this must not happen`)
        }

        await makeDir(state.outputDir)
        process.chdir(state.outputDir) // important for npm install

        const tarFile = await downloadRepo('prisma', 'prisma-examples', examples!.meta.branch)
        setActiveIndex(1)
        await extractExample(tarFile, selectedExample!.path, state.outputDir)

        const newSchema = introspectionResult
          ? await replaceGenerator(introspectionResult, photonDefaultConfig)
          : await getReplacementSchema()

        await writeFile(schemaPath, newSchema)

        // replace example if it's based on introspection
        if (introspectionResult) {
          const pathToScript =
            state.selectedLanguage === 'javascript'
              ? path.join(state.outputDir, 'script.js')
              : path.join(state.outputDir, 'script.ts')

          // TODO: Use more sophisticated example as specified here https://prisma-specs.netlify.com/cli/init/introspection-results/
          const newScript = await exampleScript({
            typescript: state.selectedLanguage === 'typescript',
            datamodel: introspectionResult,
          })
          if (await exists(pathToScript)) {
            await writeFile(pathToScript, newScript)
          }
        }

        setActiveIndex(2)
      } catch (e) {
        const error = e.stderr || e.stdout || e.message
        setError(commandError + '\n' + error)
        await new Promise(r => {
          setTimeout(r)
        })
        process.exit(1)
      }
    }
    if (examples && activeIndex === 0) {
      prepare()
    }
  }, [examples, state])

  useEffect(() => {
    async function runCommand() {
      const step = selectedExample!.setupCommands.slice(0, commandsSlice)[activeIndex - 2]
      if (step) {
        try {
          const command = replacePrisma2Command(step.command)
          debug(`Executing ${command}`)
          await execa.shell(command, {
            cwd: state.outputDir,
            preferLocal: true,
            stdio: !debugEnabled ? undefined : ['inherit', 'inherit', 'inherit'],
          })
        } catch (e) {
          const error = e.stderr || e.stdout || e.message
          setError(commandError + '\n' + error)
          await new Promise(r => {
            setTimeout(r)
          })
          process.exit(1)
        }
        setActiveIndex(activeIndex + 1)
      } else {
        if (debugEnabled) {
          debug('Done')
          process.exit(0)
        } else {
          router.setRoute('success')
        }
      }
    }
    if (examples && activeIndex > 1) {
      runCommand() // because https://github.com/facebook/react/issues/14326#issuecomment-441680293
    }
  }, [examples, activeIndex])

  return debugEnabled ? (
    <Box>Debugging</Box>
  ) : (
    <Box flexDirection="column">
      {showEmptyDirError ? (
        <EmptyDirError />
      ) : (
        <>
          <Box flexDirection="column" marginBottom={1}>
            {state.useDemoScript ? (
              <Color>
                Preparing your demo script <Color bold>({beautifyLanguage(state.selectedLanguage!)})</Color> ...
              </Color>
            ) : (
              <Color>
                Preparing your starter kit: <Color bold>{selectedExample.name}</Color>
              </Color>
            )}
          </Box>
          <DownloadProgress steps={steps} activeIndex={activeIndex} />
          {commandError && (
            <Box flexDirection="column">
              <ErrorBox>Error during command execution</ErrorBox>
              {commandError}
            </Box>
          )}
          <Box>{logs}</Box>
        </>
      )}
    </Box>
  )
}

export default Step60DownloadExample

export async function downloadRepo(organization: string, repo: string, branch: string): Promise<string> {
  const downloadUrl = `https://api.github.com/repos/${organization}/${repo}/tarball/${branch}` // TODO: use master instead of prisma2
  const tmpFile = getTmpFile(`prisma-download-${organization}-${repo}-${branch}.tar.gz`)
  const response = await fetch(downloadUrl, {
    agent: getProxyAgent(downloadUrl),
    headers: {
      'User-Agent': 'prisma/prisma-init',
    },
  })
  await new Promise((resolve, reject) => {
    response.body
      .pipe(fs.createWriteStream(tmpFile))
      .on('error', reject)
      .on('close', resolve)
  })
  return tmpFile
}

export async function extractExample(tmpPath: string, examplePath: string, outputPath: string): Promise<void> {
  await tar.extract({
    file: tmpPath,
    cwd: outputPath,
    filter: filePath => {
      return !filePath.includes('/.github/') && RegExp(examplePath).test(filePath)
    },
    strip: examplePath.split('/').length - 1,
  })
}

function getTmpFile(filename: string): string {
  const tmpDir = os.tmpdir()
  return path.join(tmpDir, filename)
}

function credentialsToDataSource(credentials: DatabaseCredentials): DataSource {
  return {
    name: 'db',
    url: {
      value: credentials.uri || credentialsToUri(credentials),
      fromEnvVar: null,
    },
    config: {},
    connectorType: databaseTypeToConnectorType(credentials.type),
  }
}

function databaseTypeToConnectorType(databaseType: DatabaseType): ConnectorType {
  switch (databaseType) {
    case DatabaseType.sqlite:
      return 'sqlite'
    case DatabaseType.postgres:
      return 'postgresql'
    case DatabaseType.mysql:
      return 'mysql'
    case DatabaseType.mongo:
      return 'mongo'
  }
}

export function replacePrisma2Command(command: string): string {
  if (command === 'npm install') {
    return 'yarn install'
  }
  if (/^prisma2\s/.test(command)) {
    return `"${process.argv[0]}" "${process.argv[1]}" ${command.slice(8)}`
  }

  return command
}
