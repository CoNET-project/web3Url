const REQUEST_EVENT = 'conet-web3-gateway-request'
const RESPONSE_EVENT = 'conet-web3-gateway-response'

type PageRequest = {
  source: 'conet-web3-page'
  id: string
  rawUrl: string
  init?: RequestInit
}

type PageResponse = {
  source: 'conet-web3-extension'
  id: string
  ok: boolean
  status?: number
  headers?: Record<string, string>
  contentType?: string
  bodyBase64?: string
  error?: string
}

window.addEventListener(REQUEST_EVENT, event => {
  const request = (event as CustomEvent<PageRequest>).detail
  if (!request || request.source !== 'conet-web3-page' || typeof request.id !== 'string') return

  void chrome.runtime.sendMessage({
    type: 'web3.fetch',
    rawUrl: request.rawUrl,
    init: request.init
  }).then(result => {
    const response = result as PageResponse
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: { ...response, source: 'conet-web3-extension', id: request.id }
    }))
  }).catch(error => {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: {
        source: 'conet-web3-extension',
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : 'Gateway request failed'
      } satisfies PageResponse
    }))
  })
})
