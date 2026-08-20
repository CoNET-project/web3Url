import { describe, expect, it } from 'vitest'
import { formatWeb3ResourceUrl, parseWeb3ResourceUrl } from '../src/protocol/web3Url'

describe('web3 resource URL', () => {
  it('parses an EOA resource', () => {
    const parsed = parseWeb3ResourceUrl('web3://0x1111111111111111111111111111111111111111/app/index.html?a=1')
    expect(parsed.target).toEqual({ kind: 'eoa', value: '0x1111111111111111111111111111111111111111' })
    expect(parsed.path).toBe('/app/index.html')
    expect(parsed.query).toBe('a=1')
  })

  it('preserves exact tag case', () => {
    const parsed = parseWeb3ResourceUrl('web3://CoNET.web3/')
    expect(parsed.target).toEqual({ kind: 'tag', value: 'CoNET' })
    expect(formatWeb3ResourceUrl(parsed)).toBe('web3://CoNET.web3/')
  })

  it('rejects ambiguous destinations', () => {
    expect(() => parseWeb3ResourceUrl('web3://results[0]/index.html')).toThrow()
    expect(() => parseWeb3ResourceUrl('web3://0x1234/p2p/geth')).toThrow()
  })
})
