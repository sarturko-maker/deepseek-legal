/** The distributable entry is checked independently of TypeScript source resolution. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'

it('loads the declared ESM artifact and anchors the bundle plugin beside its patch', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const manifest = z.object({ exports: z.object({ '.': z.object({ default: z.string() }), './editor': z.object({ default: z.string() }) }) })
    .parse(JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')))
  const entry = resolve(root, manifest.exports['.'].default)
  const smoke = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const plugin = await import(${JSON.stringify(pathToFileURL(entry).href)}); if (typeof plugin.apply !== 'function' || 'default' in plugin) process.exit(1);`],
  { cwd: root, encoding: 'utf8', timeout: 10000,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|TOKEN|SECRET|PASSWORD)/iu.test(name))) })
  expect(smoke.error).toBeUndefined()
  expect(smoke.signal).toBeNull()
  expect(smoke.status, smoke.stderr).toBe(0)
  const patches = loadOverlayPatches('dsh', resolve(root, 'cordis.patch.yml'))
  expect(patches[0]?.insert?.[0]?.name).toBe(pathToFileURL(entry).href)
  const editorEntry = resolve(root, manifest.exports['./editor'].default)
  const editorSmoke = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const plugin = await import(${JSON.stringify(pathToFileURL(editorEntry).href)}); if (typeof plugin.apply !== 'function' || !plugin.inject.includes('webServer')) process.exit(1);`],
  { cwd: root, encoding: 'utf8', timeout: 10000,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|TOKEN|SECRET|PASSWORD)/iu.test(name))) })
  expect(editorSmoke.error).toBeUndefined()
  expect(editorSmoke.signal).toBeNull()
  expect(editorSmoke.status, editorSmoke.stderr).toBe(0)
  const editorPatches = loadOverlayPatches('dsh', resolve(root, 'editor/cordis.patch.yml'))
  expect(editorPatches[0]).toMatchObject({ id: 'deepseek-legal-redlining', config: {
    editor: { parentOrigin: 'dsh-app://app', editorOrigin: 'http://127.0.0.1:9980', callbackOrigin: 'http://host.docker.internal:19387' },
  } })
})
