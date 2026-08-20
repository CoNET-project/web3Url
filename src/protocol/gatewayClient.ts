import type { GatewayRequest, GatewayResponse } from './gatewayEnvelope'
import { assertGatewayResponse, toPostBody } from './gatewayEnvelope'
import { encryptForUserPgp, decryptWithPgp, signRequest } from '../crypto/gatewayCrypto'
import type { SearchKey } from '../routing/addressPgpClient'
import { EntryPool } from '../routing/entryPool'

export type GatewayFetchInput = {
  from: string
  targetUrl: string
  method: string
  path: string
  query: string
  headers?: Record<string, string>
  body?: Uint8Array
  contentType?: string
}

export async function gatewayFetch(
  input: GatewayFetchInput,
  identity: { walletPrivateKey: string; pgpPrivateKeyArmored: string; pgpPublicKeyArmored: string },
  targetRoute: SearchKey,
  entries: EntryPool,
  now = Math.floor(Date.now() / 1000)
): Promise<GatewayResponse> {
  const request: GatewayRequest = {
    v: 1,
    type: 'conet_web3_request_v1',
    requestId: crypto.randomUUID(),
    from: input.from,
    target: input.targetUrl,
    method: input.method.toUpperCase(),
    path: input.path || '/',
    query: input.query,
    headers: sanitizeHeaders(input.headers),
    bodyBase64: input.body ? bytesToBase64(input.body) : undefined,
    contentType: input.contentType,
    nonce: crypto.randomUUID(),
    expiresAt: now + 60
  }
  const requestJson = JSON.stringify(request)
  const signedRequest = JSON.stringify({
    request,
    signMessage: await signRequest(identity.walletPrivateKey, requestJson)
  })
  // The business request is encrypted for the target user. The route key is
  // only the mailbox envelope used to reach B; B must not read the request.
  const userCiphertext = await encryptForUserPgp(signedRequest, targetRoute.userPublicKeyArmored)
  const mailboxWork = JSON.stringify({ data: userCiphertext })
  const encryptedMailboxWork = await encryptForUserPgp(mailboxWork, targetRoute.routePublicKeyArmored)
  const responseArmor = await entries.post(toPostBody(encryptedMailboxWork))
  const responseJson = await decryptWithPgp(responseArmor, identity.pgpPrivateKeyArmored)
  const response = JSON.parse(responseJson) as GatewayResponse
  assertGatewayResponse(response)
  if (response.requestId !== request.requestId || response.expiresAt < now) {
    throw new Error('Gateway response does not match request')
  }
  return response
}

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const allowed = new Set(['accept', 'content-type', 'if-none-match', 'if-modified-since'])
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(([key]) => allowed.has(key.toLowerCase()))
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
