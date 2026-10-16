import { describe, expect, it } from 'vitest'
import { canonicalResolvedTargetUrl } from '../src/browser/gatewayPreparation'
import { parseWeb3ResourceUrl } from '../src/protocol/web3Url'

describe('gateway target preparation', () => {
  it('replaces an exact tag with its resolved EOA before sending', () => {
    const parsed = parseWeb3ResourceUrl('web3://ExampleMerchant.web3/app?a=1#local')

    expect(canonicalResolvedTargetUrl(
      parsed,
      '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD'
    )).toBe('web3://0xabcdefabcdefabcdefabcdefabcdefabcdefabcd/app?a=1')
  })
})
