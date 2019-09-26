import { getPlatform } from '@prisma/get-platform'
import AdmZip from 'adm-zip'
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

export async function sendPanic(error: LiftPanic, cliVersion: string, binaryVersion: string) {
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
    })

    const zip = await makeErrorZip(error)
    await uploadZip(zip, signedUrl)

    await makeErrorReportCompleted(signedUrl)
  } catch (e) {
    throw e
  }
}

async function uploadZip(zip: Buffer, url: string) {
  return fetch(url, {
    method: 'PUT',
    agent: getProxyAgent(url),
    body: zip,
  })
}

async function makeErrorZip(error: LiftPanic): Promise<Buffer> {
  const schema = fs.readFileSync(error.schemaPath, 'utf-8')
  const maskedSchema = maskSchema(schema)
  const zip = new AdmZip()
  zip.addFile('schema.prisma', Buffer.alloc(maskedSchema.length), maskedSchema)

  const schemaDir = path.dirname(error.schemaPath)

  if (fs.existsSync(schemaDir)) {
    const filePaths = await globby('*', {
      cwd: schemaDir,
    })
    for (const filePath of filePaths) {
      zip.addLocalFile(path.join(schemaDir, filePath))
    }
  }

  return zip.toBuffer()
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
}

export enum ErrorArea {
  LIFT_CLI = 'LIFT_CLI',
  PHOTON_STUDIO = 'PHOTON_STUDIO',
}

export enum ErrorKind {
  JS_ERROR = 'JS_ERROR',
  RUST_PANIC = 'RUST_PANIC',
}

export async function createErrorReport(data: CreateErrorReportInput) {
  const result = await request(
    `mutation ($data: CreateErrorReportInput!) {
    createErrorReport(data: $data)
  }`,
    { data },
  )
  return result.createErrorReport
}

export async function makeErrorReportCompleted(signedUrl: string) {
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
