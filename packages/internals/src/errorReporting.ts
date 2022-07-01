import { getProxyAgent } from '@prisma/fetch-engine'
import fetch from 'node-fetch'

import { ErrorArea } from './panic'

export enum ErrorKind {
  JS_ERROR = 'JS_ERROR',
  RUST_PANIC = 'RUST_PANIC',
}

export interface CreateErrorReportInput {
  area: ErrorArea
  binaryVersion: string // API expect this
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
  sqlDump?: string
  dbVersion?: string
}

export async function uploadZip(zip: Buffer, url: string): Promise<any> {
  return await fetch(url, {
    method: 'PUT',
    agent: getProxyAgent(url) as any,
    headers: {
      'Content-Length': String(zip.byteLength),
    },
    body: zip,
  })
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
  return await fetch(url, {
    method: 'POST',
    agent: getProxyAgent(url) as any,
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.errors) {
        throw new Error(JSON.stringify(res.errors))
      }
      return res.data
    })
}
