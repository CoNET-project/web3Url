import { JsonRpcProvider, Contract, getAddress } from 'ethers'

export const CONET_RPC_URL = 'https://rpc1.conet.network'
export const CONET_RPC_FALLBACK_URL = 'https://publicrpc.conet.network'
export const ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'

export type SearchKey = {
  userPgpKeyId: string
  userPublicKeyArmored: string
  routePgpKeyId: string
  routePublicKeyArmored: string
}

const ABI = [
  'function searchKey(address) view returns (string userPgpKeyID, string userPublicKeyArmored, string routeKeyID, string routePublicKeyArmored, bool routeOnline)'
]

export async function fetchSearchKey(eoa: string, rpcUrl = CONET_RPC_URL): Promise<SearchKey> {
  const provider = new JsonRpcProvider(rpcUrl)
  const contract = new Contract(ADDRESS_PGP, ABI, provider)
  const result = await contract.searchKey(getAddress(eoa))
  if (!result.userPublicKeyArmored || !result.routePublicKeyArmored) {
    throw new Error('Target has no registered PGP route')
  }
  return {
    userPgpKeyId: result.userPgpKeyID,
    userPublicKeyArmored: result.userPublicKeyArmored,
    routePgpKeyId: result.routeKeyID,
    routePublicKeyArmored: result.routePublicKeyArmored
  }
}

export async function fetchSearchKeyWithFallback(eoa: string): Promise<SearchKey> {
  try {
    return await fetchSearchKey(eoa)
  } catch (primaryError) {
    try {
      return await fetchSearchKey(eoa, CONET_RPC_FALLBACK_URL)
    } catch {
      throw primaryError
    }
  }
}
