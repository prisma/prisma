import { GeneratorOptions, GeneratorManifest, JsonRPC } from './types'
import byline from './byline'

export interface Handler {
  onGenerate(options: GeneratorOptions): Promise<any>
  onManifest?(): GeneratorManifest
}

export function generatorHandler(handler: Handler): void {
  byline(process.stdin).on('data', async (line) => {
    const json = JSON.parse(String(line))

    if (json.method === 'generate' && json.params) {
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
    }

    if (json.method === 'getManifest') {
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
    }
  })

  process.stdin.resume()
}

function respond(response: JsonRPC.Response): void {
  console.error(JSON.stringify(response))
}
