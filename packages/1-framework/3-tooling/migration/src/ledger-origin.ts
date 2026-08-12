import { EMPTY_CONTRACT_HASH } from './constants';

export function ledgerOriginFromStored(originCoreHash: string | null): string | null {
  if (originCoreHash === null || originCoreHash === '' || originCoreHash === EMPTY_CONTRACT_HASH) {
    return null;
  }
  return originCoreHash;
}
