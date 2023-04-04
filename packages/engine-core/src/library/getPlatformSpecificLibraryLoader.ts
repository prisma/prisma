import { EngineConfig } from '../common/Engine'
import { DefaultLibraryLoader } from './DefaultLibraryLoader'
import { LinuxLibraryLoader } from './LinuxLibraryLoader'
import { LibraryLoader } from './types/Library'

export function getPlatformSpecificLibraryLoader(config: EngineConfig): LibraryLoader {
  if (process.platform === 'linux') {
    return new LinuxLibraryLoader(config)
  }
  return new DefaultLibraryLoader(config)
}
