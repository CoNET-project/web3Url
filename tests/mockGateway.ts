import type { EntryTransport } from '../src/routing/entryPool'
import { decryptWithPgp, encryptForUserPgp } from '../src/crypto/gatewayCrypto'

export function createMockGatewayTransport(options: {
  routePrivateKeyArmored: string
  targetUserPrivateKeyArmored: string
  requesterPublicKeyArmored: string
}): EntryTransport {
  return async (_entry, body, _signal) => {
    const routeWork = JSON.parse(
      await decryptWithPgp(body.data, options.routePrivateKeyArmored)
    ) as { data: string }
    const signedRequest = JSON.parse(
      await decryptWithPgp(routeWork.data, options.targetUserPrivateKeyArmored)
    ) as { request: { requestId: string; nonce: string }; signMessage: string }

    const response = {
      v: 1 as const,
      type: 'conet_web3_response_v1' as const,
      requestId: signedRequest.request.requestId,
      status: 200,
      headers: { 'x-conet-mock': 'true' },
      contentType: 'text/plain',
      bodyBase64: btoa('mock gateway response'),
      nonce: signedRequest.request.nonce,
      expiresAt: Math.floor(Date.now() / 1000) + 60
    }
    return encryptForUserPgp(JSON.stringify(response), options.requesterPublicKeyArmored)
  }
}
