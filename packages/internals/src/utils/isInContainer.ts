import fs from 'node:fs'

/**
 * Check if we're running inside a container.
 * Checks for common signs of Docker, Podman, and Kubernetes.
 */
export function isInContainer(): boolean {
  try {
    return (
      fs.existsSync('/.dockerenv') ||
      fs.existsSync('/run/.containerenv') ||
      process.pid === 1 ||
      process.env.KUBERNETES_SERVICE_HOST !== undefined
    )
  } catch {
    return false
  }
}
