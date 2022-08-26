import { enginesOverride } from '../packages/fetch-engine/package.json'

let exitCode = 0

function main() {
  if (enginesOverride?.['folder'] !== undefined) {
    console.log('Remove `folder` in `enginesOverride` from fetch-engine/package.json')
    exitCode = 1
  }

  if (enginesOverride?.['branch'] !== undefined) {
    console.log('Remove `branch` in `enginesOverride` from fetch-engine/package.json')
    exitCode = 1
  }

  process.exit(exitCode)
}

void main()
