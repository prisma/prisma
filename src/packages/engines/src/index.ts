import path from 'path'

export function getEnginesPath() {
  return path.join(__dirname, '../')
}

export { enginesVersion } from '@prisma/engines-version'
