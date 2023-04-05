import { readdirSync, statSync } from 'fs'
import { digraph } from 'graphviz-mit'
import { join } from 'path'

const getDirectories = (path: string) => {
  const packages = readdirSync(path).filter((any) => statSync(join(path, any)).isDirectory())
  const result = packages.map((pkg) => ({
    dirName: pkg,
    path: join('..', path, pkg),
    jsonPath: join('..', path, pkg, './package.json'),
  }))
  return result
}

const getKeys = (obj: any, name) => {
  if (obj && obj[name]) {
    return Object.keys(obj[name]).filter((name) => name.includes('prisma'))
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
  packages?.forEach((pkg) => {
    try {
      const json = require(pkg.jsonPath)
      g.addNode(json.name, { shape: 'box' })
      const keys = getKeys(json, type)
      keys.forEach((key) => {
        g.addEdge(json.name, key, {})
      })
    } catch {}
  })
  g.output('png', `./graphs/${type}.png`, (err, stdout, stderr) => {
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
