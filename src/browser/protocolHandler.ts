import { gatewayFetch } from '../protocol/gatewayClient'
import { gatewayResponseToResponse } from './blobResponse'
import { assertRequestAllowed, sanitizeResourceHeaders } from './requestPolicy'
import { prepareGatewayTarget, unlockIdentity } from '../background/serviceWorker'
import type { EntryPool } from '../routing/entryPool'

export type Web3FetchDependencies = {
  entries: EntryPool
  resolveExactTag: (tag: string) => Promise<{ address: string; accountName: string } | undefined>
}

export async function fetchWeb3Resource(
  rawUrl: string,
  init: RequestInit | undefined,
  password: string,
  dependencies: Web3FetchDependencies
): Promise<Response> {
  const request = new Request(rawUrl, init)
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : new Uint8Array(await request.arrayBuffer())
  assertRequestAllowed(request.method, body)

  const target = await prepareGatewayTarget(rawUrl, dependencies.resolveExactTag)
  const identity = await unlockIdentity(password)
  const response = await gatewayFetch(
    {
      from: identity.walletAddress,
      targetUrl: rawUrl,
      method: request.method,
      path: target.parsed.path,
      query: target.parsed.query,
      headers: sanitizeResourceHeaders(request.headers),
      body,
      contentType: request.headers.get('content-type') ?? undefined
    },
    identity,
    target.route,
    dependencies.entries
  )
  return gatewayResponseToResponse(response)
}
