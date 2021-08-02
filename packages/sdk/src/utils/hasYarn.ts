import execa from 'execa'

/**
 * Checks if yarn is available
 * we can't check with `npm ls -g yarn --depth=0` as yarn can be installed locally
 *
 * @param {string} packageDir
 * @return {boolean}
 */
export async function hasYarn(packageDir: string): Promise<boolean> {
  try {
    await execa.command('yarn --version', {
      shell: true,
      cwd: packageDir,
    })
    return true
  } catch (e) {
    // if we are here - yarn is not installed
    return false
  }
}
