import { login, LoginOptions, refreshToken } from './auth'
import { createManagementApiClient } from './client'
import { CredentialStorage, defaultCredentialsStorage } from './credentials'

export async function createAuthenticatedManagementApiClient(
  options: LoginOptions,
  storage: CredentialStorage = defaultCredentialsStorage,
) {
  let authResult = (await storage.load()) ?? (await login(options))

  const tokenRefreshHandler = async () => {
    authResult = await refreshToken(authResult.refreshToken)
    await storage.save(authResult)
    return { token: authResult.token }
  }

  return createManagementApiClient(authResult.token, tokenRefreshHandler)
}
