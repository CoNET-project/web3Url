#!/usr/bin/env node
import { createHash, webcrypto } from 'node:crypto'
import { ethers } from 'ethers'
import * as openpgp from 'openpgp'

const RPC = 'https://rpc1.conet.network'
const REGISTER = 'https://beamio.app/api/regiestChatRoute'
const ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
const ROUTE_KEY_ID = process.env.WEB3_ROUTE_KEY_ID ?? '9977E9A45187DD80'
const ENTRY = (process.env.WEB3_ENTRY ?? 'http://20ab90fe82d0e9e3.conet.network').replace(/\/+$/, '')
const OFFICIAL_EOA = '0xA8386335F1a8C6Fab3798F36cd4F663Ce7bF5A53'
const TARGET = `web3://${OFFICIAL_EOA}/`
const provider = new ethers.JsonRpcProvider(RPC, 224422, { staticNetwork: true })
const pgp = new ethers.Contract(ADDRESS_PGP, ['function searchKey(address) view returns (string,string,string,string,bool)'], provider)
const wallet = ethers.Wallet.createRandom()
const generated = await openpgp.generateKey({
  type: 'ecc', curve: 'curve25519Legacy',
  userIDs: [{ name: wallet.address, email: `${wallet.address.toLowerCase()}@web3.smoke` }],
  format: 'armored',
})
const publicKey = await openpgp.readKey({ armoredKey: generated.publicKey })
const userKeyId = (publicKey.getKeyIDs()[1] ?? publicKey.getKeyIDs()[0]).toHex().toUpperCase()

console.error('[smoke] register')
await registerRoute()
console.error('[smoke] resolve sender')
const senderRoute = await searchKey(wallet.address)
console.error('[smoke] resolve official')
const official = await searchKey(OFFICIAL_EOA)
console.error('[smoke] direct origin')
const direct = new Uint8Array(await (await fetch('https://conet.network/')).arrayBuffer())
const controller = new AbortController()
console.error('[smoke] listen')
const responsePromise = listenForResponse(senderRoute.routePublicKeyArmored, controller.signal)
await new Promise((resolve) => setTimeout(resolve, 1_000))
console.error('[smoke] request')
await sendRequest(official)
const response = await responsePromise
controller.abort()
const body = Buffer.from(response.bodyBase64, 'base64')
const gatewayHash = sha256(body)
const directHash = sha256(direct)
console.log(JSON.stringify({
  ok: response.status === 200 && response.contentType.includes('text/html'),
  sender: wallet.address, target: TARGET, status: response.status,
  contentType: response.contentType, bodyBytes: body.length,
  containsConetNetwork: body.toString('utf8').includes('conet.network'),
  gatewaySha256: gatewayHash, directSha256: directHash,
  exactBodyMatch: gatewayHash === directHash,
}))

async function registerRoute() {
  const encrypted = await encryptRegistration(generated.privateKey, wallet.privateKey)
  const result = await fetch(REGISTER, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      wallet: wallet.address, keyID: userKeyId,
      publicKeyArmored: Buffer.from(generated.publicKey).toString('base64'),
      encrypKeyArmored: encrypted, routeKeyID: ROUTE_KEY_ID,
    }),
  })
  if (!result.ok) throw new Error(`regiestChatRoute HTTP ${result.status}: ${(await result.text()).slice(0, 120)}`)
}

async function searchKey(address) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = await pgp.searchKey(ethers.getAddress(address))
    const user = decodeArmor(String(row[1]))
    const route = decodeArmor(String(row[3]))
    if (user.includes('BEGIN PGP') && route.includes('BEGIN PGP')) {
      return { userPublicKeyArmored: user, routePublicKeyArmored: route }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`searchKey unavailable for ${address}`)
}

async function sendRequest(officialRoute) {
  const request = {
    v: 1, type: 'conet_web3_request_v1', requestId: randomId(),
    from: wallet.address, target: TARGET, method: 'GET', path: '/', query: '',
    headers: { accept: 'text/html' }, nonce: randomId(),
    expiresAt: Math.floor(Date.now() / 1_000) + 120,
  }
  const signMessage = await wallet.signMessage(JSON.stringify(request))
  const recipient = await openpgp.readKey({ armoredKey: officialRoute.userPublicKeyArmored })
  const message = await openpgp.createMessage({ text: JSON.stringify({ request, signMessage }) })
  const userCiphertext = await openpgp.encrypt({ message, encryptionKeys: recipient, format: 'armored' })
  const mailboxWork = JSON.stringify({ data: userCiphertext })
  const routeKey = await openpgp.readKey({ armoredKey: officialRoute.routePublicKeyArmored })
  const routeMessage = await openpgp.createMessage({ text: mailboxWork })
  const armor = await openpgp.encrypt({ message: routeMessage, encryptionKeys: routeKey, format: 'armored' })
  const result = await fetch(`${ENTRY}/post`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: armor }),
  })
  if (!result.ok) throw new Error(`gateway request HTTP ${result.status}`)
}

async function listenForResponse(routeArmor, signal) {
  const command = JSON.stringify({
    command: 'mining', listenKind: 'chat', walletAddress: wallet.address.toLowerCase(),
    timestamp: Math.floor(Date.now() / 1_000),
  })
  const signature = await wallet.signMessage(command)
  const inner = Buffer.from(JSON.stringify({ message: command, signMessage: signature })).toString('base64')
  const routeKey = await openpgp.readKey({ armoredKey: routeArmor })
  const message = await openpgp.createMessage({ text: inner })
  const armor = await openpgp.encrypt({ message, encryptionKeys: routeKey, format: 'armored' })
  const result = await fetch(`${ENTRY}/post`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: armor }), signal,
  })
  if (!result.ok || !result.body) throw new Error(`listen HTTP ${result.status}`)
  let buffer = ''
  let armorBuffer = ''
  for await (const chunk of result.body) {
    buffer += new TextDecoder().decode(chunk)
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const rawLine of lines) {
      let line = rawLine.startsWith('data:') ? rawLine.slice(5).trimStart() : rawLine
      try {
        const parsed = JSON.parse(line)
        if (typeof parsed?.data === 'string') line = parsed.data
      } catch {
        // Raw armor and heartbeat frames are also valid.
      }
      if (line.includes('-----BEGIN PGP MESSAGE-----')) {
        armorBuffer = `${line}\n`
      } else if (armorBuffer) {
        armorBuffer += `${line}\n`
      } else {
        continue
      }
      if (!armorBuffer.includes('-----END PGP MESSAGE-----')) continue
      const armor = armorBuffer
      armorBuffer = ''
      console.error(`[smoke] candidate armor length=${armor.length}`)
      let encrypted
      try {
        encrypted = await openpgp.readMessage({ armoredMessage: armor })
      } catch (error) {
        console.error(`[smoke] ignored malformed SSE candidate: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      const secret = await openpgp.readPrivateKey({ armoredKey: generated.privateKey })
      const plain = await openpgp.decrypt({ message: encrypted, decryptionKeys: secret, format: 'utf8' })
      const value = JSON.parse(plain.data)
      if (value.type === 'conet_web3_response_v1') return value
    }
  }
  throw new Error('response stream closed before gateway response')
}

async function encryptRegistration(armor, password) {
  const hash = new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const key = await webcrypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(armor)))
  return Buffer.from(new Uint8Array([...iv, ...ciphertext])).toString('base64')
}
function decodeArmor(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith('-----BEGIN PGP')) return trimmed
  return Buffer.from(trimmed, 'base64').toString('utf8')
}
function randomId() {
  return Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('hex')
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
