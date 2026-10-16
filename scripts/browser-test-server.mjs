#!/usr/bin/env node

import http from 'node:http'

const host = process.env.BROWSER_TEST_HOST ?? '127.0.0.1'
const port = Number(process.env.BROWSER_TEST_PORT ?? '4173')
const target = 'web3://0xA8386335F1a8C6Fab3798F36cd4F663Ce7bF5A53/'

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CoNET Web3 Gateway Browser Test</title>
  <style>
    body { max-width: 760px; margin: 48px auto; padding: 0 20px; font: 16px system-ui, sans-serif; color: #172033; }
    button { padding: 10px 16px; border: 0; border-radius: 8px; background: #0051d1; color: white; cursor: pointer; }
    code, pre { overflow-wrap: anywhere; }
    pre { padding: 16px; border-radius: 8px; background: #f2f5fa; white-space: pre-wrap; }
    #status { min-height: 24px; }
  </style>
</head>
<body>
  <h1>CoNET Web3 Gateway Browser Test</h1>
  <p>This page sends the exact official gateway target through the extension page bridge:</p>
  <p><code>${target}</code></p>
  <button id="fetch" type="button">Fetch through real SI</button>
  <p id="status" role="status">Load the unpacked extension, unlock identity, configure an Entry, then click the button.</p>
  <pre id="result"></pre>
  <script>
    const target = ${JSON.stringify(target)}
    const requestEvent = 'conet-web3-gateway-request'
    const responseEvent = 'conet-web3-gateway-response'
    const status = document.querySelector('#status')
    const result = document.querySelector('#result')
    let sequence = 0

    document.querySelector('#fetch').addEventListener('click', () => {
      const id = 'browser-test-' + (++sequence)
      status.textContent = 'Waiting for the extension and real SI response…'
      result.textContent = ''
      const onResponse = event => {
        const value = event.detail
        if (!value || value.id !== id) return
        window.removeEventListener(responseEvent, onResponse)
        if (!value.ok) {
          status.textContent = 'Gateway request failed'
          result.textContent = value.error || 'Unknown error'
          return
        }
        const bytes = Uint8Array.from(atob(value.bodyBase64 || ''), char => char.charCodeAt(0))
        const body = new TextDecoder().decode(bytes)
        status.textContent = 'Gateway request succeeded'
        result.textContent = JSON.stringify({
          target,
          status: value.status,
          contentType: value.contentType,
          bodyBytes: bytes.byteLength,
          containsConetNetwork: body.includes('conet.network'),
          bodyPreview: body.slice(0, 500)
        }, null, 2)
      }
      window.addEventListener(responseEvent, onResponse)
      window.dispatchEvent(new CustomEvent(requestEvent, {
        detail: { source: 'conet-web3-page', id, rawUrl: target }
      }))
    })
  </script>
</body>
</html>`

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' || new URL(request.url ?? '/', `http://${host}`).pathname !== '/') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('not found')
    return
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(page)
})

server.listen(port, host, () => {
  console.log(`[browser-test] open http://${host}:${port}/`)
  console.log(`[browser-test] target ${target}`)
})
