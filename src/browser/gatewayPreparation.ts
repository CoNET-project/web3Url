import {
  formatWeb3ResourceUrl,
  parseWeb3ResourceUrl,
  type Web3ResourceUrl
} from '../protocol/web3Url'
import { resolveTarget } from '../routing/targetResolver'
import { fetchSearchKeyWithFallback } from '../routing/addressPgpClient'
import { loadIdentity } from '../storage/encryptedVault'

export async function prepareGatewayTarget(
  rawUrl: string,
  resolveExactTag: (tag: string) => Promise<{ address: string; accountName: string } | undefined>
) {
  const parsed = parseWeb3ResourceUrl(rawUrl)
  const eoa = await resolveTarget(parsed.target, resolveExactTag)
  const route = await fetchSearchKeyWithFallback(eoa)
  return { parsed, eoa, route }
}

export function canonicalResolvedTargetUrl(parsed: Web3ResourceUrl, eoa: string): string {
  return formatWeb3ResourceUrl({
    target: { kind: 'eoa', value: eoa.toLowerCase() },
    path: parsed.path,
    query: parsed.query,
    fragment: ''
  })
}

export async function unlockIdentity(password: string) {
  return loadIdentity(password)
}
