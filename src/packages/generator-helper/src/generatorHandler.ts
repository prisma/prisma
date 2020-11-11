import { GeneratorOptions, GeneratorManifest, JsonRPC } from './types'
import byline from './byline'

export interface Handler {
  onGenerate(options: GeneratorOptions): Promise<any>
  onManifest?(): GeneratorManifest
  onUseMessage?(options: GeneratorOptions): Promise<string>
}

export function generatorHandler(handler: Handler): void {
  byline(process.stdin).on('data', async (line) => {
    const json = JSON.parse(String(line))

    if (json.method === 'generate') {
      if (json.params) {
        try {
          const result = await handler.onGenerate(json.params)
          respond({
            jsonrpc: '2.0',
            result: result,
            id: json.id,
          })
        } catch (e) {
          respond({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: e.stack || e.message,
              data: null,
            },
            id: json.id,
          })
        }
      } else {
        respond({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'params are missing',
            data: null,
          },
          id: json.id,
        })
      }
    } else if (json.method === 'getManifest') {
      if (handler.onManifest) {
        try {
          const manifest = handler.onManifest()
          respond({
            jsonrpc: '2.0',
            result: {
              manifest,
            },
            id: json.id,
          })
        } catch (e) {
          respond({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: e.stack || e.message,
              data: null,
            },
            id: json.id,
          })
        }
      } else {
        respond({
          jsonrpc: '2.0',
          result: {
            manifest: null,
          },
          id: json.id,
        })
      }
    } else if (json.method === 'useMessage') {
      if (handler.onUseMessage) {
        try {
          const result = await handler.onUseMessage(json.params)
          respond({
            jsonrpc: '2.0',
            result: String(result),
            id: json.id,
          })
        } catch (e) {
          respond({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: e.stack || e.message,
              data: null,
            },
            id: json.id,
          })
        }
      } else {
        respond({
          jsonrpc: '2.0',
          result: '',
          id: json.id,
        })
      }
    } else { // unknown method - respond with error
      respond({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Method "${json.method}" not implemented`,
          data: null,
        },
        id: json.id,
      })
    }
  })

  process.stdin.resume()
}

function respond(response: JsonRPC.Response): void {
  console.error(JSON.stringify(response))
}
