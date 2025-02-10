export interface EventCapture {
  capture(id: string, name: string, payload: unknown): Promise<void>
}

export class EventCaptureError extends Error {
  constructor(event: string, status: string) {
    super(`Failed to submit Posthog event '${event}': ${status}`)
  }
}

const posthogCaptureUrl = new URL('https://proxyhog.prisma-data.net/capture')
const posthogKey = 'phc_gr2e9OTFh5iwE6IOuHPngwVm9jDtbC04nBjb8gcVG9a'

type PosthogCapture<Props> = {
  api_key: string
  event: string
  distinct_id: string
  properties: Props
}

export class PosthogEventCapture implements EventCapture {
  async capture(id: string, name: string, payload: unknown) {
    const capture: PosthogCapture<unknown> = {
      api_key: posthogKey,
      event: name,
      distinct_id: id,
      properties: payload,
    }

    const resp = await fetch(posthogCaptureUrl.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(capture),
    })
    if (!resp.ok) {
      throw new EventCaptureError(name, resp.statusText)
    }
  }
}
