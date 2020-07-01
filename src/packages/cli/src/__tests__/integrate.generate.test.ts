import tempy from 'tempy'
import path from 'path'
import copy from '@apexearth/copy'
import execa from 'execa'
import snapshot from 'snap-shot-it'
import assert from 'assert'
import 'ts-node/register'

describe('generate', () => {
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
    const data = await execa.node(
      path.join(__dirname, '../../build/index.js'),
      ['generate'],
      {
        cwd: target,
        stdio: 'pipe',
      },
    )

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    // run code
    const { main } = await import(path.join(target, 'main.ts'))
    const result = await main()
    snapshot(result)
  })

  it('should error with exit code 1 with incorrect schema', async () => {
    // get temp dir
    const target = tempy.directory()
    // copy example into temp dir
    // why a tmp dir? To make sure, we're outside of this workspace
    await copy({
      from: path.join(__dirname, './fixtures/broken-example-project'),
      to: target,
      recursive: true,
    })
    // generate into temp dir
    try {
      const data = await execa.node(
        path.join(__dirname, '../../build/index.js'),
        ['generate'],
        {
          cwd: target,
          stdio: 'pipe',
        },
      )
    } catch (e) {
      assert.equal(e.exitCode, 1)
    }
  })
})
