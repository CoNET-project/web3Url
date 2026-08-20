# CoNET Web3 Gateway Extension

This repository contains the first-stage WebExtension scaffold for Chrome,
Edge, Firefox, and Safari. It parses `web3://` resource URLs and provides a
shared TypeScript core for CoNET L0 gateway transport.

## Implemented

- Parses `web3://<EOA>/<path>` and `web3://<ExactTag>.web3/<path>`.
- Requires exact, case-sensitive BeamioTag resolution and rejects ambiguous
  search results instead of selecting `results[0]`.
- Creates a local communication EOA wallet and PGP identity from the settings
  page.
- Stores the identity using PBKDF2 and AES-GCM encrypted extension storage.
- Reads AddressPGP `searchKey(address)` through `rpc1.conet.network`, with
  `publicrpc.conet.network` as the fallback RPC.
- Provides versioned gateway request/response envelopes, wallet signatures,
  PGP encryption, and Blob/Response conversion.
- Provides Entry pool rotation, timeouts, and retry/failover behavior.
- Includes a complete mock gateway round-trip test without connecting to a
  production SI.
- Includes a page bridge using `postMessage` and extension runtime messaging.
- Includes Chrome/Edge, Firefox, and Safari manifest declarations.
- Includes `options.html` for identity creation/unlock and HTTPS Entry
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
