import 'ts-node/register'
import { printUpdateMessage } from '../utils/printUpdateMessage'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should display a update message w/ dev tag', async () => {
  printUpdateMessage({
    status: 'ok',
    // @ts-ignore
    data: {
      previous_version: '2.6.1',
      current_version: '2.7.0',
      package: '@prisma/cli',
      release_tag: 'dev',
    },
  })
  // @ts-ignore
  const message = ctx.mocked['console.error'].mock.calls[0][0]

  // process.stdout.write(message + "\n")
  expect(message).toMatchSnapshot()
})

it('should display a update message w/o tag', async () => {
  printUpdateMessage({
    status: 'ok',
    // @ts-ignore
    data: {
      previous_version: '2.6.1',
      current_version: '2.7.0',
      package: '@prisma/cli',
      release_tag: 'latest',
    },
  })
  // @ts-ignore
  const message = ctx.mocked['console.error'].mock.calls[0][0]

  // process.stdout.write(message + "\n")
  expect(message).toMatchSnapshot()
})
