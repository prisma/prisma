export type Request = {
  jsonrpc: '2.0'
  method: string
  params?: any
  id: number
}

export type Response = SuccessResponse | ErrorResponse

export type SuccessResponse = {
  jsonrpc: '2.0'
  result: any
  id: number
}

export type ErrorResponse = {
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data: any
  }
  id: number
}

export function isErrorResponse(response: Response): response is ErrorResponse {
  return (response as ErrorResponse).error !== undefined
}
