import Debug from '@prisma/debug'
import execa from 'execa'

const debug = Debug('getLatestAlphaTag')

export async function getLatestAlphaTag(): Promise<any> {
  const result = await execa(`./getLatestAlphaTag.sh`, { cwd: __dirname })
  const sha = result.stdout.split(' ')[0]
  if (sha.length !== 40) {
    throw new Error('Error while executing getLatestAlphaTag.sh')
  }
  debug(`Found latest alpha tag: ${result.stdout}`)
  return sha
}
