const STORAGE_KEY = 'conet.web3.gateway.vault.v1'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

type VaultRecord = {
  salt: string
  iv: string
  ciphertext: string
}

export type LocalIdentity = {
  walletPrivateKey: string
  walletAddress: string
  pgpPrivateKeyArmored: string
  pgpPublicKeyArmored: string
  pgpKeyId: string
}

export interface VaultStorage {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export const extensionStorage: VaultStorage = {
  async get(key) {
    const result = await chrome.storage.local.get(key)
    return result?.[key] as string | undefined
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },
  async remove(key) {
    await chrome.storage.local.remove(key)
  }
}

export async function saveIdentity(identity: LocalIdentity, password: string, storage = extensionStorage) {
  if (!password) throw new Error('Vault password is required')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt.buffer as ArrayBuffer)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(JSON.stringify(identity)).buffer as ArrayBuffer
  )
  const record: VaultRecord = { salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) }
  await storage.set(STORAGE_KEY, JSON.stringify(record))
}

export async function loadIdentity(password: string, storage = extensionStorage): Promise<LocalIdentity> {
  const raw = await storage.get(STORAGE_KEY)
  if (!raw) throw new Error('No local identity found')
  const record = JSON.parse(raw) as VaultRecord
  const key = await deriveKey(password, decode(record.salt).buffer as ArrayBuffer)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(record.iv).buffer as ArrayBuffer },
    key,
    decode(record.ciphertext).buffer as ArrayBuffer
  )
  return JSON.parse(decoder.decode(plaintext)) as LocalIdentity
}

export async function hasIdentity(storage = extensionStorage): Promise<boolean> {
  return Boolean(await storage.get(STORAGE_KEY))
}

export async function deleteIdentity(storage = extensionStorage): Promise<void> {
  await storage.remove(STORAGE_KEY)
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decode(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}
