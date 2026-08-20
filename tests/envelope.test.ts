import { describe, expect, it } from 'vitest'
import { assertGatewayResponse, toPostBody } from '../src/protocol/gatewayEnvelope'

describe('gateway envelope', () => {
  it('keeps the HTTP outer contract to data only', () => {
    expect(toPostBody('-----BEGIN PGP MESSAGE-----')).toEqual({
      data: '-----BEGIN PGP MESSAGE-----'
    })
  })

  it('rejects malformed response data', () => {
    expect(() => assertGatewayResponse({ type: 'wrong' })).toThrow()
  })
})
