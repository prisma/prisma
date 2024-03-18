import esbuild from 'esbuild'

import { MemoryTestDir } from './MemoryTestDir'

/**
 * Bundles memory test file and all its dependencies with esbuild
 * @param testDir
 */
export async function buildMemoryTest(testDir: MemoryTestDir): Promise<void> {
  await esbuild.build({
    entryPoints: [testDir.sourceTestPath],
    platform: 'node',
    outfile: testDir.compiledTestPath,
    bundle: true,
  })
}
