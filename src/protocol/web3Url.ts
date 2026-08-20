export type Web3Target =
  | { kind: 'eoa'; value: string }
  | { kind: 'tag'; value: string }

export type Web3ResourceUrl = {
  target: Web3Target
  path: string
  query: string
  fragment: string
  original: string
}

const EOA_RE = /^0x[0-9a-fA-F]{40}$/
const TAG_RE = /^[A-Za-z0-9_-]+$/

export function parseWeb3ResourceUrl(raw: string): Web3ResourceUrl {
  const value = raw.trim()
  if (!/^web3:\/\//i.test(value)) throw new Error('URL must start with web3://')
  const withoutScheme = value.replace(/^web3:\/\//i, '')
  const match = withoutScheme.match(/^([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/)
  if (!match) throw new Error('Invalid web3:// URL')

  const host = match[1]
  const target = parseTarget(host)
  const path = match[2] || '/'
  if (path.includes('\\') || path.includes('//')) throw new Error('Invalid resource path')

  return {
    target,
    path,
    query: match[3] || '',
    fragment: match[4] || '',
    original: value
  }
}

export function formatWeb3ResourceUrl(input: Omit<Web3ResourceUrl, 'original'>): string {
  const host = input.target.kind === 'eoa' ? input.target.value : `${input.target.value}.web3`
  const query = input.query ? `?${input.query}` : ''
  const fragment = input.fragment ? `#${input.fragment}` : ''
  return `web3://${host}${input.path || '/'}${query}${fragment}`
}

function parseTarget(host: string): Web3Target {
  if (host === 'results[0]' || host.includes('search-users')) {
    throw new Error('Ambiguous search result cannot be a destination')
  }
  if (host.endsWith('.web3') || host.endsWith('.WEB3')) {
    const tag = host.slice(0, -5)
    if (!tag || !TAG_RE.test(tag)) throw new Error('Invalid exact BeamioTag')
    return { kind: 'tag', value: tag }
  }
  if (!EOA_RE.test(host)) throw new Error('Target must be an EOA or ExactTag.web3')
  return { kind: 'eoa', value: host.toLowerCase() }
}
