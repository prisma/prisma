/**
 * Returns true, if semver version `a` is lower than `b`
 * Note: This obviously doesn't support the full semver spec.
 * @param {string} a
 * @param {string} b
 */
export function semverLt(a, b) {
  const [major1, minor1, patch1] = a.split('.')
  const [major2, minor2, patch2] = b.split('.')

  if (major1 < major2) {
    return true
  }

  if (major1 > major2) {
    return false
  }

  if (minor1 < minor2) {
    return true
  }

  if (minor1 > minor2) {
    return false
  }

  if (patch1 < patch2) {
    return true
  }

  if (patch1 > patch2) {
    return false
  }

  return false
}
