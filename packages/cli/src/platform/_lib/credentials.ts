import fs from 'fs-extra'
import path from 'node:path'
import XdgAppPaths from 'xdg-app-paths'

import { loadJsonFile } from './jsonFile'
import { unknownToError } from './prelude'

export interface Credentials {
  token: string
}

export const credentialsFileDirectoryPath = new XdgAppPaths('prisma-platform-cli').config()

export const credentialsFilePath = path.join(credentialsFileDirectoryPath, 'auth.json')

export const parseCredentials = (data: unknown): Credentials => {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid credentials')
  if (typeof data.token !== 'string') throw new Error('Invalid credentials')
  return data as Credentials
}

export const credentialsFile = {
  path: credentialsFilePath,
  save: async (data: Credentials) =>
    fs
      .mkdirp(credentialsFileDirectoryPath)
      .then(() => fs.writeJSON(credentialsFilePath, data))
      .catch(unknownToError),
  load: async (): Promise<Credentials | null | Error> =>
    fs
      .pathExists(credentialsFilePath)
      .then((exists) => (exists ? loadJsonFile(credentialsFilePath).then(parseCredentials) : null))
      .catch(unknownToError),
  delete: async () =>
    fs
      .pathExists(credentialsFilePath)
      .then((exists) => (exists ? fs.remove(credentialsFilePath) : undefined))
      .then(() => null)
      .catch(unknownToError),
}
