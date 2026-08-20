import { Wallet } from 'ethers'
import * as openpgp from 'openpgp'

export async function signRequest(privateKey: string, requestJson: string): Promise<string> {
  return new Wallet(privateKey).signMessage(requestJson)
}

export async function encryptForUserPgp(plaintext: string, publicKeyArmored: string): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })
  const message = await openpgp.createMessage({ text: plaintext })
  return openpgp.encrypt({ message, encryptionKeys: publicKey, format: 'armored' }) as Promise<string>
}

export async function decryptWithPgp(armoredCiphertext: string, privateKeyArmored: string): Promise<string> {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  const message = await openpgp.readMessage({ armoredMessage: armoredCiphertext })
  const result = await openpgp.decrypt({ message, decryptionKeys: privateKey, format: 'utf8' })
  return result.data as string
}
