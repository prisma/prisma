import { printUpdateMessage } from '../utils/printUpdateMessage'

test('long integration version name', () => {
  printUpdateMessage({
    status: 'ok',
    data: {
      client_event_id: '',
      previous_client_event_id: '',
      product: '',
      cli_path_hash: '',
      local_timestamp: '',
      previous_version: '4.5.0-integration-use-keep-alive-for-node-fetch.1',
      current_version: '4.6.0',
      current_release_date: Date.now(),
      current_download_url: '',
      current_changelog_url: '',
      package: '',
      release_tag: '',
      install_command: '',
      project_website: '',
      outdated: true,
      alerts: [],
    },
  })
})
