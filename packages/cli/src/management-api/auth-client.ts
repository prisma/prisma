import { login, refreshToken } from './auth'
import { createManagementApiClient } from './client'
import { loadCredentials, saveCredentials } from './credentials'

// TODO: it should take a credential storage as an argument
// and not hardcode `loadCredentials`/`saveCredentials` functions.
export async function createAuthenticatedManagementApiClient() {
  let authResult = (await loadCredentials()) ?? (await login())

  const tokenRefreshHandler = async () => {
    authResult = await refreshToken(authResult.refreshToken)
    await saveCredentials(authResult)
    return { token: authResult.token }
  }

  return createManagementApiClient(authResult.token, tokenRefreshHandler)
}
