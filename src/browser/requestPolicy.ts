const MAX_REQUEST_BYTES = 2 * 1024 * 1024
const SAFE_METHODS = new Set(['GET', 'HEAD', 'POST'])

export function assertRequestAllowed(method: string, body?: Uint8Array): void {
  if (!SAFE_METHODS.has(method.toUpperCase())) throw new Error('HTTP method is not allowed')
  if (body && body.byteLength > MAX_REQUEST_BYTES) throw new Error('Request body exceeds size limit')
}

export function sanitizeResourceHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const input = new Headers(headers)
  input.forEach((value, key) => {
    if (['accept', 'content-type', 'if-none-match', 'if-modified-since'].includes(key)) result[key] = value
  })
  return result
}
