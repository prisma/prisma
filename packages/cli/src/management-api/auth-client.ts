import type { ManagementAPI } from '@prisma/management-api-sdk'
import { createManagementAPI } from '@prisma/management-api-sdk'

import { FileTokenStorage } from './token-storage'

const CLIENT_ID = 'cmi4ttoor03pv2wco4526rnin'

export function createAuthenticatedManagementAPI(): ManagementAPI {
  const tokenStorage = new FileTokenStorage()

  return createManagementAPI({
    clientId: CLIENT_ID,
    redirectUri: 'http://localhost:0/auth/callback', // Not used when tokens already exist
    tokenStorage,
  })
}
