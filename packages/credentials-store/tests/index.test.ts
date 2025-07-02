import { readFile } from 'fs/promises'
import path from 'path'
import tempy from 'tempy'
import { beforeEach, describe, expect, it } from 'vitest'

import { Credentials, CredentialsStore } from '../src'

describe('CredentialsStore', () => {
  const mockCredentials: Credentials = {
    workspaceId: 'test-workspace-id',
    token: 'test-token',
    refreshToken: 'test-refresh-token',
  }

  let authFilePath: string
  let store: CredentialsStore

  beforeEach(() => {
    authFilePath = path.join(tempy.directory(), 'auth.json')
    store = new CredentialsStore(authFilePath)
  })

  it('should initialize with correct auth file path', async () => {
    await store.storeCredentials(mockCredentials)

    const fileContent = await readFile(authFilePath, 'utf-8')
    const parsedContent = JSON.parse(fileContent)
    expect(parsedContent).toEqual({ tokens: [mockCredentials] })
  })

  it('should load credentials from disk', async () => {
    await store.storeCredentials(mockCredentials)

    // Create a new store instance to test loading
    const newStore = new CredentialsStore(authFilePath)
    const credentials = await newStore.getCredentials()

    expect(credentials).toEqual([mockCredentials])
  })

  it('should handle non-existent auth file', async () => {
    const newStore = new CredentialsStore(authFilePath)
    const credentials = await newStore.getCredentials()
    expect(credentials).toEqual([])
  })

  it('should store credentials', async () => {
    await store.storeCredentials(mockCredentials)

    const fileContent = await readFile(authFilePath, 'utf-8')
    const parsedContent = JSON.parse(fileContent)

    expect(parsedContent).toEqual({ tokens: [mockCredentials] })
  })

  it('should update existing credentials for same workspace', async () => {
    const updatedCredentials = {
      ...mockCredentials,
      token: 'new-token',
    }

    await store.storeCredentials(mockCredentials)
    await store.storeCredentials(updatedCredentials)

    const credentials = await store.getCredentials()
    expect(credentials).toHaveLength(1)
    expect(credentials[0].token).toBe('new-token')

    const fileContent = await readFile(authFilePath, 'utf-8')
    const parsedContent = JSON.parse(fileContent)
    expect(parsedContent).toEqual({ tokens: [updatedCredentials] })
  })

  it('should get credentials for specific workspace', async () => {
    const otherCredentials: Credentials = {
      workspaceId: 'other-workspace-id',
      token: 'other-token',
      refreshToken: 'other-refresh-token',
    }

    await store.storeCredentials(mockCredentials)
    await store.storeCredentials(otherCredentials)

    const workspaceCredentials = await store.getCredentialsForWorkspace('test-workspace-id')
    expect(workspaceCredentials).toEqual(mockCredentials)

    const fileContent = await readFile(authFilePath, 'utf-8')
    const parsedContent = JSON.parse(fileContent)
    expect(parsedContent).toEqual({ tokens: [mockCredentials, otherCredentials] })
  })

  it('should return undefined for non-existent workspace', async () => {
    await store.storeCredentials(mockCredentials)

    const workspaceCredentials = await store.getCredentialsForWorkspace('non-existent-id')
    expect(workspaceCredentials).toBeUndefined()
  })

  it('should delete credentials for a workspace', async () => {
    const otherCredentials: Credentials = {
      workspaceId: 'other-workspace-id',
      token: 'other-token',
      refreshToken: 'other-refresh-token',
    }

    await store.storeCredentials(mockCredentials)
    await store.storeCredentials(otherCredentials)

    await store.deleteCredentials('test-workspace-id')

    const credentials = await store.getCredentials()
    expect(credentials).toHaveLength(1)
    expect(credentials[0]).toEqual(otherCredentials)

    const fileContent = await readFile(authFilePath, 'utf-8')
    const parsedContent = JSON.parse(fileContent)
    expect(parsedContent).toEqual({ tokens: [otherCredentials] })
  })
})
