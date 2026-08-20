export const GATEWAY_PROTOCOL_VERSION = 1

export type GatewayRequest = {
  v: 1
  type: 'conet_web3_request_v1'
  requestId: string
  from: string
  target: string
  method: string
  path: string
  query: string
  headers: Record<string, string>
  bodyBase64?: string
  contentType?: string
  nonce: string
  expiresAt: number
}

export type GatewayResponse = {
  v: 1
  type: 'conet_web3_response_v1'
  requestId: string
  status: number
  headers: Record<string, string>
  contentType: string
  bodyBase64: string
  nonce: string
  expiresAt: number
}

export type PostBody = { data: string }

export function assertGatewayResponse(value: unknown): asserts value is GatewayResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid gateway response')
  const response = value as Partial<GatewayResponse>
  if (response.v !== 1 || response.type !== 'conet_web3_response_v1') {
    throw new Error('Unsupported gateway response version')
  }
  if (!response.requestId || !Number.isInteger(response.status)) {
    throw new Error('Malformed gateway response')
  }
  if (typeof response.bodyBase64 !== 'string' || typeof response.contentType !== 'string') {
    throw new Error('Malformed gateway body')
  }
}

export function toPostBody(armoredCiphertext: string): PostBody {
  if (!armoredCiphertext.includes('BEGIN PGP MESSAGE')) throw new Error('Expected PGP armor')
  return { data: armoredCiphertext }
}
