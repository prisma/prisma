import fs from 'fs-extra'
import path from 'path'
import XdgAppPaths from 'xdg-app-paths'

export interface AuthConfig {
  token?: string | null
}

export const configDirectoryPath = new XdgAppPaths('prisma-platform-cli').config()
export const authConfigPath = path.join(configDirectoryPath, 'auth.json')

export async function writeAuthConfig(data: AuthConfig) {
  await fs.mkdirp(configDirectoryPath)

  return await fs.writeJSON(authConfigPath, data)
}

export async function readAuthConfig(): Promise<AuthConfig> {
  if (!(await fs.pathExists(authConfigPath))) {
    return {
      token: null,
    }
  }

  return await fs.readJSON(authConfigPath)
}

export async function deleteAuthConfig() {
  if (!(await fs.pathExists(authConfigPath))) {
    return {
      token: null,
    }
  }

  return await fs.remove(authConfigPath)
}
