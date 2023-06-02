import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  ResourceNotFoundException,
  State,
} from '@aws-sdk/client-lambda'
import archiver from 'archiver'
import fg from 'fast-glob'
import { createWriteStream, readFileSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { TextDecoder } from 'util'

import { Target } from './base'

type Config = {
  aws: {
    region: string
    executionRole: string
    memorySize: number
  }
}

const functionName = 'PrismaPerfTest'

export class LambdaTarget implements Target {
  private config = readConfig()
  private client = new LambdaClient({ region: this.config.aws.region })

  getBinaryTargets(): string[] {
    return ['rhel-openssl-1.0.x']
  }

  async afterPnpmInstall(workbenchPath: string): Promise<void> {
    await fs.copyFile(path.join(__dirname, 'measureLambda.mjs'), path.join(workbenchPath, 'measureLambda.mjs'))
  }

  async afterClientGeneration(workbenchPath: string): Promise<void> {
    const archivePath = path.join(workbenchPath, 'func.zip')
    await archiveClient(workbenchPath, archivePath)

    await this.deleteFunction()
    await this.createFunction(archivePath)
  }

  private async deleteFunction() {
    const command = new DeleteFunctionCommand({
      FunctionName: functionName,
    })

    try {
      await this.client.send(command)
    } catch (e) {
      if (!(e instanceof ResourceNotFoundException)) {
        throw e
      }
    }
  }

  private async createFunction(archivePath: string) {
    const command = new CreateFunctionCommand({
      FunctionName: functionName,
      Role: this.config.aws.executionRole,
      Runtime: 'nodejs18.x',
      Handler: 'measureLambda.handler',
      Code: {
        ZipFile: await fs.readFile(archivePath),
      },
      Environment: {
        Variables: {
          PRISMA_SHOW_ALL_TRACES: 'true',
          DATABASE_URL: process.env.DATABASE_URL!,
        },
      },
      TracingConfig: {
        Mode: 'Active',
      },
      // Layers: [`arn:aws:lambda:${this.config.aws.region}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-12-0:1`],
      Timeout: 30,
      MemorySize: this.config.aws.memorySize,
    })

    const response = await this.client.send(command)
    await this.waitUntilActive(response.State)
  }

  async waitUntilActive(state?: State | string) {
    let timeout = 100
    while (state !== State.Active) {
      await setTimeout(timeout)
      timeout *= 2
      const command = new GetFunctionCommand({ FunctionName: functionName })
      const result = await this.client.send(command)
      state = result.Configuration?.State
    }
  }

  async measure(): Promise<Record<string, number>> {
    const command = new InvokeCommand({
      FunctionName: functionName,
    })

    const response = await this.client.send(command)
    if (response.FunctionError) {
      let msg = ''
      if (response.Payload) {
        msg = new TextDecoder('utf8').decode(response.Payload)
      }

      throw new Error(`Lambda function error: ${msg}`)
    }

    if (!response.Payload) {
      throw new Error('Got empty payload')
    }

    const resultStr = new TextDecoder('utf8').decode(response.Payload)

    return JSON.parse(resultStr)
  }
}

async function archiveClient(workbenchPath: string, archivePath: string) {
  const files = fg.stream(
    [
      'node_modules/**',
      '!node_modules/prisma/**',
      'prisma/client/*.js',
      'prisma/client/package.json',
      'prisma/client/schema.prisma',
      'prisma/client/runtime/*.js',
      'prisma/client/libquery_engine-rhel-openssl-1.0.x.so.node',
      '*.js',
      '*.mjs',
    ],
    {
      cwd: workbenchPath,
    },
  ) as AsyncIterable<string>

  const archive = archiver('zip', { zlib: { level: 9 } })
  //   archive.pipe(createWriteStream(archivePath))
  for await (const file of files) {
    archive.file(path.join(workbenchPath, file), { name: file })
  }

  const resultPromise = pipeline(archive, createWriteStream(archivePath))
  await archive.finalize()
  await resultPromise
}

function readConfig(): Config {
  return JSON.parse(readFileSync(path.resolve(__dirname, '..', 'config.json'), 'utf8'))
}
