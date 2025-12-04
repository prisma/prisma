/* eslint-disable @typescript-eslint/unbound-method */
import { login, refreshToken } from './auth'
import { createAuthenticatedManagementApiClient } from './auth-client'
import { createManagementApiClient } from './client'
import { CredentialStorage } from './credentials'

jest.mock('./auth')
jest.mock('./client')

describe('createAuthenticatedManagementApiClient', () => {
  const mockLogin = login as jest.Mock
  const mockRefreshToken = refreshToken as jest.Mock
  const mockCreateClient = createManagementApiClient as jest.Mock

  const mockStorage: CredentialStorage = {
    load: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should use storage.load() to get credentials', async () => {
    const credentials = { token: 'token', refreshToken: 'refresh' }
    ;(mockStorage.load as jest.Mock).mockResolvedValue(credentials)

    await createAuthenticatedManagementApiClient({ utmMedium: 'test' }, mockStorage)

    expect(mockStorage.load as jest.Mock).toHaveBeenCalled()
    expect(mockLogin).not.toHaveBeenCalled()
    expect(mockCreateClient).toHaveBeenCalledWith('token', expect.any(Function))
  })

  it('should fallback to login() if storage.load() returns undefined', async () => {
    ;(mockStorage.load as jest.Mock).mockResolvedValue(undefined)
    const credentials = { token: 'new-token', refreshToken: 'new-refresh' }
    mockLogin.mockResolvedValue(credentials)

    await createAuthenticatedManagementApiClient({ utmMedium: 'test' }, mockStorage)

    expect(mockStorage.load as jest.Mock).toHaveBeenCalled()
    expect(mockLogin).toHaveBeenCalled()
    expect(mockCreateClient).toHaveBeenCalledWith('new-token', expect.any(Function))
  })

  it('should save new credentials on token refresh', async () => {
    const credentials = { token: 'token', refreshToken: 'refresh' }
    ;(mockStorage.load as jest.Mock).mockResolvedValue(credentials)

    await createAuthenticatedManagementApiClient({ utmMedium: 'test' }, mockStorage)

    const refreshHandler = mockCreateClient.mock.calls[0][1]
    const newCredentials = { token: 'refreshed-token', refreshToken: 'refreshed-refresh' }
    mockRefreshToken.mockResolvedValue(newCredentials)

    const result = await refreshHandler()

    expect(mockRefreshToken).toHaveBeenCalledWith('refresh')
    expect(mockStorage.save as jest.Mock).toHaveBeenCalledWith(newCredentials)
    expect(result).toEqual({ token: 'refreshed-token' })
  })
})
