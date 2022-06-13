import { jestConsoleContext, jestContext } from '@prisma/sdk'

import { printUpdateMessage } from '../utils/printUpdateMessage'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('update available message', () => {
  it('dev tag - minor', () => {
    printUpdateMessage({
      status: 'ok',
      // @ts-ignore
      data: {
        previous_version: '2.6.1-dev.18',
        current_version: '2.16.0-dev.8',
        package: 'prisma',
        release_tag: 'dev',
      },
    })
    const message = ctx.mocked['console.error'].mock.calls[0][0]
    expect(message).toContain('npm i --save-dev prisma@dev')
    expect(message).toContain('npm i @prisma/client@dev')
    expect(message).toMatchSnapshot()
  })

  it('dev tag - major', () => {
    printUpdateMessage({
      status: 'ok',
      // @ts-ignore
      data: {
        previous_version: '2.6.1-dev.18',
        current_version: '3.0.1-dev.8',
        package: 'prisma',
        release_tag: 'dev',
      },
    })
    const message = ctx.mocked['console.error'].mock.calls[0][0]
    expect(message).toContain('This is a major update')
    expect(message).toContain('npm i --save-dev prisma@dev')
    expect(message).toContain('npm i @prisma/client@dev')
    expect(message).toMatchSnapshot()
  })

  it('latest tag - minor', () => {
    printUpdateMessage({
      status: 'ok',
      // @ts-ignore
      data: {
        previous_version: '2.6.1',
        current_version: '2.16.0',
        package: 'prisma',
        release_tag: 'latest',
      },
    })
    const message = ctx.mocked['console.error'].mock.calls[0][0]
    expect(message).toContain('npm i --save-dev prisma@latest')
    expect(message).toContain('npm i @prisma/client@latest')
    expect(message).toMatchSnapshot()
  })

  it('latest tag - major', () => {
    printUpdateMessage({
      status: 'ok',
      // @ts-ignore
      data: {
        previous_version: '2.6.1',
        current_version: '3.0.0',
        package: 'prisma',
        release_tag: 'latest',
      },
    })
    const message = ctx.mocked['console.error'].mock.calls[0][0]
    expect(message).toContain('This is a major update')
    expect(message).toContain('npm i --save-dev prisma@latest')
    expect(message).toContain('npm i @prisma/client@latest')
    expect(message).toMatchSnapshot()
  })
})
