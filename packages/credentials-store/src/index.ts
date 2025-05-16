import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import XDGAppPaths from 'xdg-app-paths'

type AuthFile = {
  tokens: Credentials[]
}

export type Credentials = {
  userName: string
  workspaceName: string
  workspaceId: string
  token: string
}

/**
 * This class is used to store and retrieve credentials for the Prisma Platform from the user's config directory.
 * A given class instance caches loaded credentials in memory.
 *
 * In the future this class might be adapted to store and retrieve credentials from other locations.
 * E.g. keychains or working directory specific locations.
 */
export class CredentialsStore {
  private loadedCredentials?: Credentials[]
  private authFilePath: string

  /**
   * @param authFilePathOverride - Override for the path to the auth file. Can also be set via the PRISMA_PLATFORM_AUTH_FILE environment variable. Useful for testing.
   */
  constructor(authFilePathOverride?: string) {
    this.authFilePath =
      process.env.PRISMA_PLATFORM_AUTH_FILE ||
      authFilePathOverride ||
      path.join(XDGAppPaths({ name: 'prisma-platform' }).config(), 'auth.json')
  }

  async reloadCredentialsFromDisk(): Promise<void> {
    try {
      const content = await readFile(this.authFilePath, 'utf-8')
      const data = JSON.parse(content) as AuthFile
      this.loadedCredentials = data.tokens || []
    } catch (error) {
      // Fallback if file not exists or invalid JSON
      this.loadedCredentials = []
    }
  }

  async storeCredentials(credentials: Credentials): Promise<void> {
    await this.reloadCredentialsFromDisk()
    this.loadedCredentials = [
      ...(this.loadedCredentials || []).filter((c) => c.workspaceId !== credentials.workspaceId),
      credentials,
    ]
    const data: AuthFile = { tokens: this.loadedCredentials }
    await mkdir(path.dirname(this.authFilePath), { recursive: true })
    await writeFile(this.authFilePath, JSON.stringify(data, null, 2))
  }

  async deleteCredentials(workspaceId: string): Promise<void> {
    await this.reloadCredentialsFromDisk()
    this.loadedCredentials = this.loadedCredentials?.filter((c) => c.workspaceId !== workspaceId) || []
    const data: AuthFile = { tokens: this.loadedCredentials }
    await mkdir(path.dirname(this.authFilePath), { recursive: true })
    await writeFile(this.authFilePath, JSON.stringify(data, null, 2))
  }

  async getCredentials(): Promise<Credentials[]> {
    if (this.loadedCredentials === undefined) {
      await this.reloadCredentialsFromDisk()
    }
    return this.loadedCredentials || []
  }

  async getCredentialsForWorkspace(workspaceId: string): Promise<Credentials | undefined> {
    return (await this.getCredentials()).filter((c) => c.workspaceId === workspaceId)[0]
  }
}
