const ENTRIES_KEY = 'conet.web3.gateway.entries.v1'

export async function loadGatewayEntries(): Promise<string[]> {
  const result = await chrome.storage.local.get(ENTRIES_KEY)
  const entries = result[ENTRIES_KEY]
  return Array.isArray(entries) ? entries.filter(isAllowedEntry) : []
}

function isAllowedEntry(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}
