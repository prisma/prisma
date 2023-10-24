export interface Request {
    jsonrpc: '2.0'
    method: string
    params?: Object,
    id: number
}

export type Response = OkResponse | ErrResponse

export interface OkResponse {
    jsonrpc: '2.0'
    result: unknown
    error?: never
    id: number
}

export interface ErrResponse {
    jsonrpc: '2.0'
    error: RpcError
    result?: never
    id: number
}

export interface RpcError {
    code: number
    message: string
    data?: unknown
}
