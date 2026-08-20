import { Wallet } from 'ethers'
import * as openpgp from 'openpgp'
import type { LocalIdentity } from '../storage/encryptedVault'

export async function createCommunicationIdentity(): Promise<LocalIdentity> {
  const wallet = Wallet.createRandom()
  const generated = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519Legacy',
    userIDs: [{ name: wallet.address, email: `${wallet.address.toLowerCase()}@web3.gateway` }],
    format: 'armored'
  })
  const publicKey = await openpgp.readKey({ armoredKey: generated.publicKey })
  const keyIds = publicKey.getKeyIDs()
  const encryptionKeyId = keyIds[1] ?? keyIds[0]
  if (!encryptionKeyId) throw new Error('Generated PGP key has no key ID')

  return {
    walletPrivateKey: wallet.privateKey,
    walletAddress: wallet.address,
    pgpPrivateKeyArmored: generated.privateKey,
    pgpPublicKeyArmored: generated.publicKey,
    pgpKeyId: encryptionKeyId.toHex().toUpperCase()
  }
}
