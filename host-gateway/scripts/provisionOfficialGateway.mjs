#!/usr/bin/env node
import { mkdir, chmod, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ethers } from 'ethers'
import * as openpgp from 'openpgp'

if (process.env.CONFIRM_OFFICIAL_GATEWAY_PROVISION !== 'YES') {
  throw new Error('Set CONFIRM_OFFICIAL_GATEWAY_PROVISION=YES to create/register the official gateway identity')
}

const rpcUrl = process.env.CONET_RPC_URL ?? 'https://rpc1.conet.network'
const registerUrl = process.env.REGIEST_URL ?? 'https://beamio.app/api/regiestChatRoute'
const routeKeyId = requireEnv('GATEWAY_ROUTE_KEY_ID')
const outputDir = process.env.GATEWAY_SECRET_DIR ?? '/etc/conet-web3-gateway/secrets'
const wallet = ethers.Wallet.createRandom()
const { privateKey: pgpPrivateArmor, publicKey: pgpPublicArmor } = await openpgp.generateKey({
  type: 'ecc',
  curve: 'curve25519',
  userIDs: [{ name: wallet.address }],
  format: 'armored',
  passphrase: '',
})
const pgpKey = await openpgp.readKey({ armoredKey: pgpPublicArmor })
const pgpKeyId = pgpKey.getKeyIDs()[1].toHex().toUpperCase()

await mkdir(outputDir, { recursive: true, mode: 0o700 })
await writeSecret(join(outputDir, 'gateway.eth'), wallet.privateKey)
await writeSecret(join(outputDir, 'gateway-pgp.asc'), pgpPrivateArmor)
await writeFile(join(outputDir, 'gateway-pgp-public.asc'), pgpPublicArmor, { mode: 0o644 })
await chmod(outputDir, 0o700)

const encryptedKey = await encryptForRegistration(pgpPrivateArmor, wallet.privateKey)
const registration = await fetch(registerUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    wallet: wallet.address,
    keyID: pgpKeyId,
    publicKeyArmored: Buffer.from(pgpPublicArmor, 'utf8').toString('base64'),
    encrypKeyArmored: encryptedKey,
    routeKeyID: routeKeyId,
  }),
})
const registrationBody = await registration.json().catch(() => ({}))
if (!registration.ok || registrationBody.ok === false) {
  throw new Error(`regiestChatRoute failed: HTTP ${registration.status}`)
}

const provider = new ethers.JsonRpcProvider(rpcUrl, 224422, { staticNetwork: true })
const pgp = new ethers.Contract(
  '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2',
  ['function searchKey(address) view returns (string,string,string,string,bool)'],
  provider,
)
console.log(JSON.stringify({
  eoa: wallet.address,
  pgpKeyId,
  routeKeyId,
  secretDir: outputDir,
  registered: true,
  searchKey: String((await pgp.searchKey(wallet.address))[0] ?? ''),
}, null, 2))

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function writeSecret(file, value) {
  await writeFile(file, `${value.trim()}\n`, { mode: 0o600 })
  await chmod(file, 0o600)
}

async function encryptForRegistration(armor, password) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(armor),
  ))
  const result = new Uint8Array(iv.length + ciphertext.length)
  result.set(iv)
  result.set(ciphertext, iv.length)
  return Buffer.from(result).toString('base64')
}
