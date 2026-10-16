import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { ethers } from 'ethers'
import * as openpgp from 'openpgp'

const RPC_URL = process.env.CONET_RPC_URL ?? 'https://rpc1.conet.network'
const ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
const REGISTERED_EOA = requireEnv('GATEWAY_EOA')
const ETH_PRIVATE_KEY_FILE = process.env.GATEWAY_ETH_PRIVATE_KEY_FILE?.trim()
const ETH_PRIVATE_KEY = process.env.GATEWAY_ETH_PRIVATE_KEY?.trim()
const PGP_PRIVATE_KEY_FILE = requireEnv('GATEWAY_PGP_PRIVATE_KEY_FILE')
const ENTRY_URLS = requireEnv('GATEWAY_ENTRY_URLS')
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean)
const UPSTREAM_ORIGIN = process.env.GATEWAY_UPSTREAM_ORIGIN ?? 'https://conet.network'
const MAX_BODY_BYTES = 8 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const RECONNECT_DELAY_MS = 3_000

type GatewayRequest = {
  v: 1
  type: 'conet_web3_request_v1'
  requestId: string
  from: string
  target: string
  method: string
  path: string
  query: string
  headers: Record<string, string>
  bodyBase64?: string
  contentType?: string
  nonce: string
  expiresAt: number
}

type SignedRequest = {
  request: GatewayRequest
  signMessage: string
}

type GatewayResponse = {
  v: 1
  type: 'conet_web3_response_v1'
  requestId: string
  status: number
  headers: Record<string, string>
  contentType: string
  bodyBase64: string
  nonce: string
  expiresAt: number
}

type SearchKey = {
  userPublicKeyArmored: string
  routePublicKeyArmored: string
}

const provider = new ethers.JsonRpcProvider(RPC_URL, 224422, { staticNetwork: true })
const wallet = new ethers.Wallet(
  ETH_PRIVATE_KEY_FILE ? requireSecretFile(ETH_PRIVATE_KEY_FILE) : requireSecretValue(ETH_PRIVATE_KEY, 'GATEWAY_ETH_PRIVATE_KEY'),
)
const configuredEoa = ethers.getAddress(REGISTERED_EOA)

if (wallet.address !== configuredEoa) {
  throw new Error('GATEWAY_ETH_PRIVATE_KEY does not match GATEWAY_EOA')
}
if (!ENTRY_URLS.length) throw new Error('GATEWAY_ENTRY_URLS must contain at least one Entry URL')

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function requireSecretValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} or ${name}_FILE is required`)
  return value
}

function requireSecretFile(file: string): string {
  const value = readFileSync(file, 'utf8').trim()
  if (!value) throw new Error(`secret file is empty: ${file}`)
  return value
}

function decodeMaybeBase64(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes('BEGIN PGP') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8')
}

function base64Encode(value: Uint8Array): string {
  return Buffer.from(value).toString('base64')
}

function base64Decode(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`operation timed out after ${milliseconds}ms`)), milliseconds)
    }),
  ])
}

async function decryptPgp(armor: string, privateArmor: string): Promise<string> {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateArmor })
  const message = await openpgp.readMessage({ armoredMessage: armor })
  const result = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    format: 'utf8',
  })
  return result.data as string
}

async function encryptPgp(plaintext: string, publicArmor: string): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: publicArmor })
  const message = await openpgp.createMessage({ text: plaintext })
  return openpgp.encrypt({ message, encryptionKeys: publicKey, format: 'armored' }) as Promise<string>
}

async function fetchSearchKey(address: string): Promise<SearchKey> {
  const contract = new ethers.Contract(
    ADDRESS_PGP,
    ['function searchKey(address) view returns (string,string,string,string,bool)'],
    provider,
  )
  const result = (await contract.searchKey(address)) as [string, string, string, string, boolean]
  const userPublicKeyArmored = decodeMaybeBase64(String(result[1] ?? ''))
  const routePublicKeyArmored = decodeMaybeBase64(String(result[3] ?? ''))
  if (!userPublicKeyArmored.includes('BEGIN PGP') || !routePublicKeyArmored.includes('BEGIN PGP')) {
    throw new Error(`AddressPGP route is incomplete for ${address}`)
  }
  return { userPublicKeyArmored, routePublicKeyArmored }
}

async function encodeListenArmor(routePublicKeyArmored: string): Promise<string> {
  const command = JSON.stringify({
    command: 'mining',
    listenKind: 'chat',
    walletAddress: configuredEoa,
    timestamp: Math.floor(Date.now() / 1000),
  })
  const wrapper = JSON.stringify({
    message: command,
    signMessage: await wallet.signMessage(command),
  })
  const wrappedBase64 = Buffer.from(wrapper, 'utf8').toString('base64')
  return encryptPgp(wrappedBase64, routePublicKeyArmored)
}

function clipArmor(value: string): string | undefined {
  const start = value.indexOf('-----BEGIN PGP MESSAGE-----')
  if (start < 0) return undefined
  const endMarker = '-----END PGP MESSAGE-----'
  const end = value.indexOf(endMarker, start)
  if (end < 0) return undefined
  return `${value.slice(start, end + endMarker.length)}\n`
}

function extractArmors(frame: string): string[] {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  const candidates = [frame.trim(), data.trim()]
  const armors: string[] = []
  for (const candidate of candidates) {
    const clipped = clipArmor(candidate)
    if (clipped && !armors.includes(clipped)) armors.push(clipped)
    try {
      const parsed = JSON.parse(candidate) as { data?: unknown }
      if (typeof parsed.data === 'string') {
        const nested = clipArmor(parsed.data)
        if (nested && !armors.includes(nested)) armors.push(nested)
      }
    } catch {
      // Heartbeats and raw armor are both valid stream frames.
    }
  }
  return armors
}

async function handleInboundArmor(armor: string, privateArmor: string): Promise<void> {
  let plain: string
  try {
    plain = await decryptPgp(armor, privateArmor)
  } catch {
    console.warn('[gateway] ignored inbound message that did not decrypt with official PGP')
    return
  }

  let businessArmor = armor
  try {
    const mailboxWork = JSON.parse(plain) as { data?: unknown }
    if (typeof mailboxWork.data === 'string' && mailboxWork.data.includes('BEGIN PGP')) {
      businessArmor = mailboxWork.data
      plain = await decryptPgp(businessArmor, privateArmor)
    }
  } catch {
    // Normal delivery is already the user-PGP ciphertext.
  }

  let signed: SignedRequest
  try {
    signed = JSON.parse(plain) as SignedRequest
  } catch {
    console.warn('[gateway] ignored non-gateway inbound message')
    return
  }
  if (!signed.request || signed.request.type !== 'conet_web3_request_v1') {
    console.warn('[gateway] ignored unsupported application message')
    return
  }

  try {
    await processRequest(signed)
  } catch (error) {
    console.error('[gateway] request failed:', error instanceof Error ? error.message : String(error))
  }
}

function validateRequest(request: GatewayRequest): void {
  if (request.v !== 1 || request.type !== 'conet_web3_request_v1') throw new Error('unsupported gateway request')
  if (!request.requestId || !request.nonce) throw new Error('gateway request identifiers are required')
  if (request.expiresAt < Math.floor(Date.now() / 1000)) throw new Error('gateway request expired')
  const from = ethers.getAddress(request.from)
  const target = request.target.match(/^web3:\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i)
  if (!target || target[1].includes(':') || ethers.getAddress(target[1]) !== configuredEoa) {
    throw new Error('gateway request target is not the official wallet')
  }
  if (!request.path.startsWith('/') || request.path.includes('\\') || request.path.includes('//')) {
    throw new Error('invalid gateway path')
  }
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) throw new Error('gateway method is not allowed')
  if (from === configuredEoa) throw new Error('gateway request must come from a different wallet')
}

async function processRequest(signed: SignedRequest): Promise<void> {
  validateRequest(signed.request)
  const requestJson = JSON.stringify(signed.request)
  const recovered = ethers.verifyMessage(requestJson, signed.signMessage)
  if (ethers.getAddress(recovered) !== ethers.getAddress(signed.request.from)) {
    throw new Error('gateway request signature does not match from')
  }

  const target = new URL(UPSTREAM_ORIGIN)
  target.pathname = signed.request.path
  target.search = signed.request.query ? `?${signed.request.query}` : ''
  const headers = new Headers()
  for (const [key, value] of Object.entries(signed.request.headers ?? {})) {
    if (['accept', 'content-type', 'if-none-match', 'if-modified-since'].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  }
  const body = signed.request.bodyBase64 ? base64Decode(signed.request.bodyBase64) : undefined
  if (body && body.byteLength > MAX_BODY_BYTES) throw new Error('gateway request body exceeds limit')

  const upstream = await withTimeout(
    fetch(target, {
      method: signed.request.method.toUpperCase(),
      headers,
      body: body ? Buffer.from(body) : undefined,
      redirect: 'manual',
    }),
    REQUEST_TIMEOUT_MS,
  )
  const bytes = new Uint8Array(await upstream.arrayBuffer())
  if (bytes.byteLength > MAX_BODY_BYTES) throw new Error('gateway response exceeds limit')
  const response: GatewayResponse = {
    v: 1,
    type: 'conet_web3_response_v1',
    requestId: signed.request.requestId,
    status: upstream.status,
    headers: {
      etag: upstream.headers.get('etag') ?? '',
      location: upstream.headers.get('location') ?? '',
      'cache-control': upstream.headers.get('cache-control') ?? '',
    },
    contentType: upstream.headers.get('content-type') ?? 'application/octet-stream',
    bodyBase64: base64Encode(bytes),
    nonce: signed.request.nonce,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  }

  const recipient = await fetchSearchKey(signed.request.from)
  const responseArmor = await encryptPgp(JSON.stringify(response), recipient.userPublicKeyArmored)
  await postToEntryPool(responseArmor)
  console.info(`[gateway] served ${signed.request.method} ${signed.request.path} status=${upstream.status}`)
}

async function postToEntryPool(armor: string): Promise<void> {
  let lastError: unknown
  for (const entry of ENTRY_URLS) {
    try {
      const response = await fetch(`${entry}/post`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', connection: 'close' },
        body: JSON.stringify({ data: armor }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.ok) return
      lastError = new Error(`Entry ${entry} returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('all gateway entries failed')
}

async function listenOnce(entry: string, privateArmor: string, routePublicKeyArmored: string): Promise<void> {
  const armor = await encodeListenArmor(routePublicKeyArmored)
  const response = await fetch(`${entry}/post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ data: armor }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok || !response.body) throw new Error(`listen Entry ${entry} returned HTTP ${response.status}`)

  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let boundary = buffer.search(/\r?\n\r?\n/)
    while (boundary >= 0) {
      const separator = buffer.match(/\r?\n\r?\n/)?.[0] ?? '\n\n'
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + separator.length)
      for (const inbound of extractArmors(frame)) {
        void handleInboundArmor(inbound, privateArmor)
      }
      boundary = buffer.search(/\r?\n\r?\n/)
    }
  }
}

async function main(): Promise<void> {
  const privateArmor = await readFile(PGP_PRIVATE_KEY_FILE, 'utf8')
  const route = await fetchSearchKey(configuredEoa)
  console.info(`[gateway] official EOA ${configuredEoa}; entries=${ENTRY_URLS.length}`)

  let index = 0
  while (true) {
    const entry = ENTRY_URLS[index % ENTRY_URLS.length]
    index += 1
    try {
      await listenOnce(entry, privateArmor, route.routePublicKeyArmored)
    } catch (error) {
      console.error('[gateway] listen disconnected:', error instanceof Error ? error.message : String(error))
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))
    }
  }
}

main().catch((error) => {
  console.error('[gateway] fatal:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
