import execa from 'execa'
import path from 'path'

process.removeAllListeners('warning')

it('should error when dependent generator is missing', async () => {
  expect.assertions(1)

  try {
    await execa.node(path.join(__dirname, '../../build/index.js'), ['generate'], {
      cwd: path.join(__dirname, './fixtures/dependent-generator'),
      stdio: 'pipe',
    })
  } catch (e) {
    expect(e.stderr).toMatchSnapshot()
  }
})
