export function isWriteRequest(clientMethod: string): boolean {
  return ['create', 'update', 'delete', 'executeRaw', 'queryRaw'].some((method) => clientMethod.includes(method))
}
