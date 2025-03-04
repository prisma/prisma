import { readdirSync, statSync } from 'node:fs'
import { digraph } from 'graphviz-mit'
import { join } from 'node:path'

const getDirectories = (path: string) => {
  const packages = readdirSync(path).filter((any) => statSync(join(path, any)).isDirectory())
  const result = packages.map((pkg) => ({
    dirName: pkg,
    path: join('..', path, pkg),
    jsonPath: join('..', path, pkg, './package.json'),
  }))
  return result
}

const getKeys = (obj: Record<string, unknown>, name: string) => {
  if (obj?.[name] && typeof obj[name] === 'object' && obj[name] !== null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Object.keys(obj[name] as Record<string, unknown>).filter((name) => name.includes('prisma'))
  }
  return []
}
function generateGraph(
  packages: {
    dirName: string
    path: string
    jsonPath: string
  }[],
  type: 'dependencies' | 'devDependencies' | 'peerDependencies',
) {
  const g = digraph('G')
  g.set('splines', 'ortho')
  for (const pkg of (packages || [])) {
    try {
      const json = require(pkg.jsonPath)
      g.addNode(json.name, { shape: 'box' })
      const keys = getKeys(json, type)
      for (const key of keys) {
        g.addEdge(json.name, key, {})
      }
    } catch {}
  }
  g.output('png', `./graphs/${type}.png`, (_err, _stdout, stderr) => {
    console.log(stderr)
  })
}
function main() {
  const packages = getDirectories('./packages')
  generateGraph(packages, 'dependencies')
  generateGraph(packages, 'devDependencies')
  generateGraph(packages, 'peerDependencies')
}
void main()
