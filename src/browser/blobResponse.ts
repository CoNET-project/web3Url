import type { GatewayResponse } from '../protocol/gatewayEnvelope'

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

export function gatewayResponseToBlob(response: GatewayResponse): Blob {
  const bytes = base64ToBytes(response.bodyBase64)
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('Gateway response exceeds size limit')
  return new Blob([bytes.buffer as ArrayBuffer], { type: response.contentType || 'application/octet-stream' })
}

export async function gatewayResponseToResponse(response: GatewayResponse): Promise<Response> {
  const blob = gatewayResponseToBlob(response)
  return new Response(blob, {
    status: response.status,
    headers: response.headers
  })
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}
