import { describe, expect, it } from 'vitest'
import { loadIdentity, saveIdentity, type LocalIdentity, type VaultStorage } from '../src/storage/encryptedVault'

class MemoryStorage implements VaultStorage {
  private values = new Map<string, string>()
  async get(key: string) { return this.values.get(key) }
  async set(key: string, value: string) { this.values.set(key, value) }
  async remove(key: string) { this.values.delete(key) }
}

const identity: LocalIdentity = {
  walletPrivateKey: '0xprivate',
  walletAddress: '0x1111111111111111111111111111111111111111',
  pgpPrivateKeyArmored: 'private',
  pgpPublicKeyArmored: 'public',
  pgpKeyId: 'ABCDEF'
}

describe('encrypted vault', () => {
  it('round-trips only with the password', async () => {
    const storage = new MemoryStorage()
    await saveIdentity(identity, 'correct horse battery staple', storage)
    await expect(loadIdentity('wrong', storage)).rejects.toBeTruthy()
    await expect(loadIdentity('correct horse battery staple', storage)).resolves.toEqual(identity)
  })
})
