import { createCommunicationIdentity } from '../identity/createIdentity'
import { hasIdentity, loadIdentity, saveIdentity } from '../storage/encryptedVault'
import { prepareGatewayTarget, unlockIdentity } from '../browser/gatewayPreparation'
import { loadGatewayEntries } from '../storage/gatewayConfig'
import { fetchWeb3ResourceWithIdentity } from '../browser/protocolHandler'
import { EntryPool } from '../routing/entryPool'

type InstallMessage = { type: 'identity.create'; password: string }
type UnlockMessage = { type: 'identity.unlock'; password: string }
type LockMessage = { type: 'identity.lock' }
type StatusMessage = { type: 'identity.status' }
type FetchMessage = { type: 'web3.fetch'; rawUrl: string; init?: RequestInit }

type Message = InstallMessage | UnlockMessage | LockMessage | StatusMessage | FetchMessage

let unlockedIdentity: Awaited<ReturnType<typeof loadIdentity>> | undefined

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as Message)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }))
  return true
})

async function handleMessage(message: Message) {
  if (message.type === 'identity.status') {
    return { ok: true, hasIdentity: await hasIdentity(), unlocked: Boolean(unlockedIdentity) }
  }
  if (message.type === 'identity.create') {
    if (await hasIdentity()) throw new Error('Identity already exists')
    const identity = await createCommunicationIdentity()
    await saveIdentity(identity, message.password)
    unlockedIdentity = identity
    return { ok: true, unlocked: true, address: identity.walletAddress, pgpKeyId: identity.pgpKeyId }
  }
  if (message.type === 'identity.unlock') {
    unlockedIdentity = await loadIdentity(message.password)
    return { ok: true, unlocked: true, address: unlockedIdentity.walletAddress }
  }
  if (message.type === 'identity.lock') {
    unlockedIdentity = undefined
    return { ok: true, unlocked: false, hasIdentity: await hasIdentity() }
  }
  if (message.type === 'web3.fetch') {
    if (!unlockedIdentity) throw new Error('Identity is locked')
    const configuredEntries = await loadGatewayEntries()
    if (!configuredEntries.length) throw new Error('No gateway entry is configured')
    const pool = new EntryPool(configuredEntries, async (entry, body, signal) => {
      const endpoint = entry.replace(/\/$/, '').endsWith('/post')
        ? entry.replace(/\/$/, '')
        : `${entry.replace(/\/$/, '')}/post`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal
      })
      if (!response.ok) throw new Error(`Gateway entry returned HTTP ${response.status}`)
      return response.text()
    })
    const response = await fetchWeb3ResourceWithIdentity(
      message.rawUrl,
      message.init,
      unlockedIdentity,
      {
        entries: pool,
        resolveExactTag: async () => {
          throw new Error('Tag resolution is not configured in this scaffold')
        }
      }
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return {
      ok: true,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      bodyBase64: btoa(binary),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream'
    }
  }
  throw new Error('Unsupported extension message')
}

chrome.runtime.onInstalled.addListener(() => {
  // Creation is initiated by the options page after explicit user intent.
})

