import { cp, mkdir, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = new URL('..', import.meta.url)
const rootPath = root.pathname
const targets = ['chrome', 'firefox', 'safari']

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true })
for (const entry of ['background', 'pageBridge', 'options']) {
  await exec('npx', ['vite', 'build'], {
    cwd: rootPath,
    env: { ...process.env, WEB3_ENTRY: entry }
  })
}
await mkdir(new URL('../dist', import.meta.url), { recursive: true })
await cp(new URL('../options.html', import.meta.url), new URL('../dist/options.html', import.meta.url))
for (const icon of ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png']) {
  await cp(new URL(`../src/assets/${icon}`, import.meta.url), new URL(`../dist/${icon}`, import.meta.url))
}
for (const target of targets) {
  await cp(new URL(`../manifest.${target}.json`, import.meta.url), new URL(`../dist/manifest.${target}.json`, import.meta.url))
}
await cp(new URL('../manifest.chrome.json', import.meta.url), new URL('../dist/manifest.json', import.meta.url))
