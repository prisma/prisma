export interface RequestError {
  error: string
  user_facing_error: {
    is_panic: boolean
    message: string
    meta?: Record<string, unknown>
    error_code?: string
    batch_request_idx?: number
  }
}
