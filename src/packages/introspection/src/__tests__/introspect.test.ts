import { Introspect } from '../commands/Introspect'
import path from 'path'

describe('introspect', () => {
  test('basic introspection', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print'])
    console.log = oldConsoleLog
    expect(logs).toMatchSnapshot()
  })

  test('introspection --force', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print', '--force'])
    console.log = oldConsoleLog
    expect(logs).toMatchSnapshot()
  })

  test('basic introspection with --url', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print', '--url', 'file:dev.db'])
    console.log = oldConsoleLog
    expect(logs).toMatchSnapshot()
  })
})
