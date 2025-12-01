import fs from 'node:fs/promises'
import path from 'node:path'

import { Debug } from '@prisma/debug'
import XdgAppPaths from 'xdg-app-paths'
import { z } from 'zod'

const debug = Debug('prisma:cli:management-api:credentials')

const credentialsSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
})

type Credentials = z.infer<typeof credentialsSchema>

export const credentialsFileDirectoryPath = new XdgAppPaths('prisma-cli').config()
export const credentialsFilePath = path.join(credentialsFileDirectoryPath, 'auth.json')

export async function loadCredentials(): Promise<Credentials | undefined> {
  try {
    const fileContent = await fs.readFile(credentialsFilePath, 'utf8')
    return credentialsSchema.parse(JSON.parse(fileContent))
  } catch (error) {
    debug(error)
    return undefined
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await fs.mkdir(credentialsFileDirectoryPath, { recursive: true })
  await fs.writeFile(credentialsFilePath, JSON.stringify(credentials, null, 2))
}
