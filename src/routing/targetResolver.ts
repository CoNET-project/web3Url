import type { Web3Target } from '../protocol/web3Url'

export type ExactTagProfile = {
  address: string
  accountName: string
}

export type ExactTagResolver = (tag: string) => Promise<ExactTagProfile | undefined>

export async function resolveTarget(target: Web3Target, resolveExactTag: ExactTagResolver): Promise<string> {
  if (target.kind === 'eoa') return target.value
  const profile = await resolveExactTag(target.value)
  if (!profile) throw new Error(`Exact BeamioTag not found: ${target.value}`)
  if (profile.accountName !== target.value) {
    throw new Error('Tag resolution was not an exact case-sensitive match')
  }
  return profile.address.toLowerCase()
}
