const statusEl = document.querySelector<HTMLParagraphElement>('#status')!
const password = document.querySelector<HTMLInputElement>('#password')!
const entries = document.querySelector<HTMLTextAreaElement>('#entries')!
const identity = document.querySelector<HTMLElement>('#identity')!

async function send(message: unknown): Promise<any> {
  return chrome.runtime.sendMessage(message)
}

async function refresh(): Promise<void> {
  const result = await send({ type: 'identity.status' })
  identity.textContent = result.hasIdentity
    ? result.unlocked ? 'Identity created and unlocked' : 'Identity created and locked'
    : 'No local identity'
}

document.querySelector<HTMLFormElement>('#identity-form')!.addEventListener('submit', async event => {
  event.preventDefault()
  const value = password.value
  if (value.length < 12) {
    statusEl.textContent = 'Use an unlock password of at least 12 characters.'
    return
  }
  const current = await send({ type: 'identity.status' })
  const result = await send({
    type: current.hasIdentity ? 'identity.unlock' : 'identity.create',
    password: value
  })
  statusEl.textContent = result.ok === false ? result.error : 'Identity is ready in memory.'
  password.value = ''
  await refresh()
})

document.querySelector<HTMLFormElement>('#entries-form')!.addEventListener('submit', async event => {
  event.preventDefault()
  const values = entries.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  const valid = values.every(value => {
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  })
  if (!valid || !values.length) {
    statusEl.textContent = 'Enter one or more HTTPS entry URLs, one per line.'
    return
  }
  await chrome.storage.local.set({ 'conet.web3.gateway.entries.v1': [...new Set(values)] })
  statusEl.textContent = 'Gateway entries saved.'
})

void refresh()
