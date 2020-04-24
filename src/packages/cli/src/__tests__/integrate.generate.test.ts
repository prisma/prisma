import tempy from 'tempy'
import path from 'path'
import copy from '@apexearth/copy'
import execa from 'execa'
import assert from 'assert'
import snapshot from 'snap-shot-it'
import 'ts-node/register'

it('should work with a custom output dir', async () => {
  // get temp dir
  const target = tempy.directory()
  // copy example into temp dir
  // why a tmp dir? To make sure, we're outside of this workspace
  await copy({
    from: path.join(__dirname, './fixtures/example-project'),
    to: target,
    recursive: true,
  })
  // generate into temp dir
  await execa.node(path.join(__dirname, '../../build/index.js'), ['generate'], {
    cwd: target,
    stdio: 'ignore',
  })
  // run code
  const { main } = await import(path.join(target, 'main.ts'))
  const result = await main()
  snapshot(result)
  assert(true)
})
