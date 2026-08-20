import { createCommunicationIdentity } from '../identity/createIdentity'
import { hasIdentity, loadIdentity, saveIdentity } from '../storage/encryptedVault'
import { parseWeb3ResourceUrl } from '../protocol/web3Url'
import { resolveTarget } from '../routing/targetResolver'
import { fetchSearchKeyWithFallback } from '../routing/addressPgpClient'

type InstallMessage = { type: 'identity.create'; password: string }
type StatusMessage = { type: 'identity.status' }
type FetchMessage = { type: 'web3.fetch'; rawUrl: string; init?: RequestInit }

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as InstallMessage | StatusMessage | FetchMessage)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }))
  return true
})

async function handleMessage(message: InstallMessage | StatusMessage | FetchMessage) {
  if (message.type === 'identity.status') return { ok: true, hasIdentity: await hasIdentity() }
  if (message.type === 'identity.create') {
    const identity = await createCommunicationIdentity()
    await saveIdentity(identity, message.password)
    return { ok: true, address: identity.walletAddress, pgpKeyId: identity.pgpKeyId }
  }
  if (message.type === 'web3.fetch') {
    void message
    return {
      ok: false,
      error: 'Gateway entry pool is not configured; refusing to send a live request'
    }
  }
  throw new Error('Unsupported extension message')
}

export async function prepareGatewayTarget(rawUrl: string, resolveExactTag: (tag: string) => Promise<{ address: string; accountName: string } | undefined>) {
  const parsed = parseWeb3ResourceUrl(rawUrl)
  const eoa = await resolveTarget(parsed.target, resolveExactTag)
  const route = await fetchSearchKeyWithFallback(eoa)
  return { parsed, eoa, route }
}

export async function unlockIdentity(password: string) {
  return loadIdentity(password)
}
