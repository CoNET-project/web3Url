# CoNET `web3://` Client

This repository contains a client-side implementation of the `web3://`
Application Protocol for Chrome, Edge, Firefox, and Safari. `web3://` uses
CoNET L0 entry and mailbox infrastructure; it is not a new L0 wire command.
The shared TypeScript core parses wallet-addressed application URLs, signs
requests, encrypts transport envelopes, correlates encrypted responses, and
adapts results for browser pages.

## Implemented

- Parses `web3://<EOA>/<path>` and `web3://<ExactTag>.web3/<path>`.
- Requires exact, case-sensitive BeamioTag resolution and rejects ambiguous
  search results instead of selecting `results[0]`.
- Creates a local communication EOA wallet and PGP identity from the settings
  page.
- Stores the identity using PBKDF2 and AES-GCM encrypted extension storage.
- Reads AddressPGP `searchKey(address)` through `rpc1.conet.network`, with
  `publicrpc.conet.network` as the fallback RPC.
- Provides versioned gateway request/response envelopes, caller wallet
  signatures, PGP encryption, response correlation, and Blob/Response
  conversion.
- Provides Entry pool rotation, timeouts, and retry/failover behavior.
- Includes a complete mock gateway round-trip test without connecting to a
  production SI.
- Includes a page bridge using `postMessage` and extension runtime messaging.
- Includes Chrome/Edge, Firefox, and Safari manifest declarations.
- Includes `options.html` for identity creation/unlock and HTTP/HTTPS Entry
  configuration.
- The service worker performs real HTTP POST requests only when the identity
  is unlocked and at least one Entry is configured. It fails closed when the
  identity is locked, no Entry is configured, or a target Tag cannot be
  resolved exactly.

## Current limitations

WebExtensions cannot reliably intercept every browser navigation using the
`web3://` scheme as an operating-system protocol handler. Each browser needs
its own native registration or wrapper integration, especially Safari.

The remaining browser-specific work includes:

1. Chrome/Edge page or native protocol registration.
2. Firefox WebExtension navigation integration.
3. Safari Web Extension container scheme handling.
4. Final Enterprise Gateway request/response contract and production Entry
   allowlist approval.

The page bridge accepts requests and the service worker can execute the A/B/C
encrypted flow after Entries are configured. Requests are rejected when the
identity is locked or no Entry is configured.

## Protocol boundaries

Business requests follow the CoNET A/B/C routing model: the client submits to
a healthy Entry and never connects directly to mailbox B.

The HTTP request body is restricted to:

```json
{ "data": "<OpenPGP armor>" }
```

The extension does not log private keys, PGP plaintext, or complete ciphertext.

This project is not a replacement for the `conet-l0d` Linux daemon and does
not start, stop, or restart geth, beacon-chain, or validator processes.

## Local checks

```bash
npm install
npm run typecheck
npm test
npm run build
```

The test suite includes PGP route-mailbox unpacking, target-user decryption,
mock response encryption, and client response validation.

## Real SI acceptance

The official gateway target is a stable integration fixture:

```text
web3://0xA8386335F1a8C6Fab3798F36cd4F663Ce7bF5A53/
```

The real smoke command creates a temporary requester EOA/PGP identity,
registers its route through the production `regiestChatRoute` endpoint,
connects to a real Entry node, listens on the requester mailbox, and compares
the returned body with `https://conet.network/`. It does not persist the
temporary private material:

```bash
npm run real:smoke
```

The Entry can be overridden for an approved production Entry:

```bash
WEB3_ENTRY=http://<entry>.conet.network npm run real:smoke
```

Do not use a mailbox B address as the Entry. The request must be sent to an
Entry and the response must be received on the requester mailbox SSE.

## Local browser bridge acceptance

This is a browser-level test of the same extension page bridge and real SI
transport. It does not register a new browser protocol handler; the test page
dispatches the `web3://` request to the content script, which forwards it to
the extension service worker.

1. Build the extension:

   ```bash
   npm run build
   ```

2. Start the local test page:

   ```bash
   npm run start:browser-test
   ```

3. In Chrome or Edge, open `chrome://extensions`, enable Developer mode, and
   load the `dist/` directory as an unpacked extension.

4. Open the extension Options page. Create/unlock the local identity with a
   password of at least 12 characters, then configure the approved real Entry
   URL, for example:

   ```text
   http://20ab90fe82d0e9e3.conet.network
   ```

5. Open `http://127.0.0.1:4173/` and click **Fetch through real SI**.

The page must report `Gateway request succeeded`, `status: 200`,
`contentType: text/html`, and `containsConetNetwork: true`. The extension
keeps the private key and PGP private key in encrypted extension storage and
uses them only in the unlocked service-worker runtime.

## Official `conet.network` host gateway

This repository also contains the server-side adapter for the official
`web3://<official-wallet-address>/` destination:

```text
host-gateway/
├── src/index.ts
├── scripts/provisionOfficialGateway.mjs
└── systemd/conet-web3-gateway.service
```

The adapter is a purpose-built Node.js host implementation of the same
`web3://` Application Protocol. Linux operators can instead use `conet-l0d`
as the general Linux server/client runtime. This adapter uses the normal
CoNET A/B/C mailbox path over HTTP Entry nodes, decrypts only messages
addressed to the official gateway identity, fetches the corresponding path
from `https://conet.network`, and encrypts the correlated response to the
requesting wallet. It accepts only `GET` and `HEAD`, forwards a small
allowlist of headers, and limits request and response bodies to 8 MiB.

Port `80` is the Entry-node HTTP port in the locator contract. The adapter
does not bind port `80` or expose a second public endpoint. This avoids
turning the mailbox route into a direct mailbox connection and preserves the
L0 A/B/C routing boundary.

### Provisioning on `conet.network`

Run the provisioning command **on the server**, never on a developer machine:

```bash
CONFIRM_OFFICIAL_GATEWAY_PROVISION=YES \
GATEWAY_ROUTE_KEY_ID=<selected-mailbox-route> \
GATEWAY_SECRET_DIR=/etc/conet-web3-gateway/secrets \
npm run provision:official-gateway
```

The command creates a fresh EOA and PGP key, registers the user PGP with
`/api/regiestChatRoute`, and writes the private material with mode `0600`.
It prints only the public EOA/key identifiers. The selected mailbox route must
be an approved route and must not be guessed from an ambiguous search result.

Create `/etc/conet-web3-gateway.env` from
`host-gateway/conet-web3-gateway.env.example`, set `GATEWAY_EOA` to the
generated address, and keep the private key paths local to the server. Then:

```bash
npm run build:host-gateway
sudo install -o root -g root -m 0644 \
  host-gateway/systemd/conet-web3-gateway.service \
  /etc/systemd/system/conet-web3-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now conet-web3-gateway
```

The gateway's private EOA and PGP files must never be committed, copied to
another host, placed in an environment variable, or written to logs.
