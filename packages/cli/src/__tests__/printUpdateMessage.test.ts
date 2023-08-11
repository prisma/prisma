import { printUpdateMessage } from '../utils/printUpdateMessage'

function printUpdateMessageFromTo(from: string, to: string): void {
  printUpdateMessage({
    status: 'ok',
    data: {
      client_event_id: '',
      previous_client_event_id: '',
      product: '',
      cli_path_hash: '',
      local_timestamp: '',
      previous_version: from,
      current_version: to,
      current_release_date: Date.now(),
      current_download_url: '',
      current_changelog_url: '',
      package: 'prisma',
      release_tag: to,
      install_command: '',
      project_website: '',
      outdated: true,
      alerts: [],
    },
  })
}

const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation()

afterEach(() => {
  consoleErrorMock.mockReset()
})

test('normal release', () => {
  printUpdateMessageFromTo('4.5.0', '4.6.0')
  expect(consoleErrorMock.mock.calls[0][0]).toMatchInlineSnapshot(`
    ┌─────────────────────────────────────────────────────────┐
    │  Update available 4.5.0 -> 4.6.0                        │
    │  Run the following to update                            │
    │    npm i --save-dev prisma@4.6.0                        │
    │    npm i @prisma/client@4.6.0                           │
    └─────────────────────────────────────────────────────────┘
  `)
})

test('integration version with long name', () => {
  printUpdateMessageFromTo('4.5.0-integration-use-keep-alive-for-node-fetch.1', '4.6.0')
  expect(consoleErrorMock.mock.calls[0][0]).toMatchInlineSnapshot(`
    ┌───────────────────────────────────────────────────────────────────────────────┐
    │  Update available 4.5.0-integration-use-keep-alive-for-node-fetch.1 -> 4.6.0  │
    │  Run the following to update                                                  │
    │    npm i --save-dev prisma@4.6.0                                              │
    │    npm i @prisma/client@4.6.0                                                 │
    └───────────────────────────────────────────────────────────────────────────────┘
  `)
})
