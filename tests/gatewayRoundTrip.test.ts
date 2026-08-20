import { describe, expect, it } from 'vitest'
import { createCommunicationIdentity } from '../src/identity/createIdentity'
import { gatewayFetch } from '../src/protocol/gatewayClient'
import { EntryPool } from '../src/routing/entryPool'
import { createMockGatewayTransport } from './mockGateway'

describe('mock gateway round trip', () => {
  it('routes, decrypts, responds, and validates the response', async () => {
    const requester = await createCommunicationIdentity()
    const target = await createCommunicationIdentity()
    const transport = createMockGatewayTransport({
      routePrivateKeyArmored: target.pgpPrivateKeyArmored,
      targetUserPrivateKeyArmored: target.pgpPrivateKeyArmored,
      requesterPublicKeyArmored: requester.pgpPublicKeyArmored
    })
    const entries = new EntryPool(['https://entry-a.invalid/post'], transport)

    const response = await gatewayFetch(
      {
        from: requester.walletAddress,
        targetUrl: 'web3://0x2222222222222222222222222222222222222222/index.html',
        method: 'GET',
        path: '/index.html',
        query: ''
      },
      requester,
      {
        userPgpKeyId: target.pgpKeyId,
        userPublicKeyArmored: target.pgpPublicKeyArmored,
        routePgpKeyId: target.pgpKeyId,
        routePublicKeyArmored: target.pgpPublicKeyArmored
      },
      entries
    )

    expect(response.status).toBe(200)
    expect(response.requestId).toBeTruthy()
    expect(response.headers['x-conet-mock']).toBe('true')
  })
})
