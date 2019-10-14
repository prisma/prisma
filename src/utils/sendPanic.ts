import { getPlatform } from '@prisma/get-platform'
import AdmZip from 'adm-zip'
import crypto from 'crypto'
import Debug from 'debug'
import fs from 'fs'
import globby from 'globby'
import fetch from 'node-fetch'
import os from 'os'
import path from 'path'
import stripAnsi from 'strip-ansi'
import { LiftPanic } from '../LiftEngine'
import { getProxyAgent } from './getProxyAgent'
import { maskSchema } from './maskSchema'
const debug = Debug('sendPanic')

export async function sendPanic(error: LiftPanic, cliVersion: string, binaryVersion: string): Promise<number | void> {
  try {
    const schema = fs.readFileSync(error.schemaPath, 'utf-8')
    const maskedSchema = maskSchema(schema)

    const signedUrl = await createErrorReport({
      area: ErrorArea.LIFT_CLI,
      kind: ErrorKind.RUST_PANIC,
      cliVersion,
      binaryVersion,
      command: process.argv.slice(2).join(' '),
      jsStackTrace: stripAnsi(error.stack || error.message),
      rustStackTrace: error.rustStack,
      operatingSystem: `${os.arch()} ${os.platform()} ${os.release()}`,
      platform: await getPlatform(),
      liftRequest: JSON.stringify(error.request),
      schemaFile: maskedSchema,
      fingerprint: getFid() || undefined,
    })

    const zip = await makeErrorZip(error)
    await uploadZip(zip, signedUrl)

    const id = await makeErrorReportCompleted(signedUrl)
    return id
  } catch (e) {
    debug(e)
  }
}

async function uploadZip(zip: Buffer, url: string) {
  return fetch(url, {
    method: 'PUT',
    agent: getProxyAgent(url),
    headers: {
      'Content-Length': zip.byteLength,
    },
    body: zip,
  })
}

async function makeErrorZip(error: LiftPanic): Promise<Buffer> {
  const schema = fs.readFileSync(error.schemaPath, 'utf-8')
  const maskedSchema = maskSchema(schema)
  const zip = new AdmZip()
  zip.addFile('schema.prisma', Buffer.alloc(maskedSchema.length, maskedSchema))

  const schemaDir = path.dirname(error.schemaPath)

  if (fs.existsSync(schemaDir)) {
    const filePaths = await globby('migrations/**/*', {
      cwd: schemaDir,
    })

    for (const filePath of filePaths) {
      let file = fs.readFileSync(path.resolve(schemaDir, filePath), 'utf-8')
      if (filePath.endsWith('schema.prisma')) {
        file = maskSchema(file)
      }
      zip.addFile(filePath, Buffer.alloc(file.length, file))
    }
  }

  return new Promise(resolve => {
    zip.toBuffer(resolve)
  })
}

export interface CreateErrorReportInput {
  area: ErrorArea
  binaryVersion: string
  cliVersion: string
  command: string
  jsStackTrace: string
  kind: ErrorKind
  liftRequest?: string
  operatingSystem: string
  platform: string
  rustStackTrace: string
  schemaFile?: string
  fingerprint?: string
}

export enum ErrorArea {
  LIFT_CLI = 'LIFT_CLI',
  PHOTON_STUDIO = 'PHOTON_STUDIO',
}

export enum ErrorKind {
  JS_ERROR = 'JS_ERROR',
  RUST_PANIC = 'RUST_PANIC',
}

export async function createErrorReport(data: CreateErrorReportInput): Promise<string> {
  const result = await request(
    `mutation ($data: CreateErrorReportInput!) {
    createErrorReport(data: $data)
  }`,
    { data },
  )
  return result.createErrorReport
}

export async function makeErrorReportCompleted(signedUrl: string): Promise<number> {
  const result = await request(
    `mutation ($signedUrl: String!) {
  markErrorReportCompleted(signedUrl: $signedUrl)
}`,
    { signedUrl },
  )
  return result.markErrorReportCompleted
}

async function request(query: string, variables: any): Promise<any> {
  const url = 'https://error-reports.prisma.sh/'
  const body = JSON.stringify({
    query,
    variables,
  })
  return fetch(url, {
    method: 'POST',
    agent: getProxyAgent(url),
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then(res => res.json())
    .then(res => {
      if (res.errors) {
        throw new Error(JSON.stringify(res.errors))
      }
      return res.data
    })
}

function getMac(): string | null {
  const interfaces = os.networkInterfaces()
  return Object.keys(interfaces).reduce<null | string>((acc, key) => {
    if (acc) {
      return acc
    }
    const i = interfaces[key]
    const mac = i.find(a => a.mac !== '00:00:00:00:00:00')
    return mac ? mac.mac : null
  }, null)
}

export function getFid() {
  const mac = getMac()
  const fidSecret = 'AhTheeR7Pee0haebui1viemoe'
  if (mac) {
    return crypto
      .createHmac('sha256', fidSecret)
      .update(mac)
      .digest('hex')
  }

  return null
}
