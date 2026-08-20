import { parseWeb3ResourceUrl } from '../protocol/web3Url'
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

export async function unlockIdentity(password: string) {
  return loadIdentity(password)
}
