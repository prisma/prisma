import { extname } from 'pathe';
import { isDynamicPattern } from 'tinyglobby';
import { contractInputDirectory } from './contract-input-directory';

export function defaultContractOutputPath(contractPath: string): string {
  if (isDynamicPattern(contractPath)) {
    const { directory } = contractInputDirectory(contractPath.replaceAll('\\', '/'));
    const separator = directory.length > 0 && !directory.endsWith('/') ? '/' : '';
    return `${directory}${separator}contract.json`;
  }
  const extension = extname(contractPath);
  return `${extension.length === 0 ? contractPath : contractPath.slice(0, -extension.length)}.json`;
}
