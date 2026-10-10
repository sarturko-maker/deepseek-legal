/** Discovery rejects unexpected addresses before the managed document is acquired. */
import { expect, it, onTestFinished, vi } from 'vitest'
import { discoverEditor } from '../src/editor/launch.ts'
import { editorConfigSchema } from '../src/editor/index.ts'

const config = editorConfigSchema.parse({ parentOrigin: 'dsh-app://app',
  editorOrigin: 'http://127.0.0.1:9980', callbackOrigin: 'http://host.docker.internal:19387' })
const action = (url = 'http://127.0.0.1:9980/browser/pinned/cool.html?&amp;lang=&lt;lang&gt;&amp;') =>
  `<wopi-discovery><net-zone><app><action ext="docx" name="edit" urlsrc="${url}"/></app></net-zone></wopi-discovery>`

function discovery(xml: string, status = 200): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(xml, { status }))
  vi.stubGlobal('fetch', fetcher)
  onTestFinished(() => { vi.unstubAllGlobals() })
  return fetcher
}

it('uses only the discovered DOCX edit path at the configured origin', async () => {
  const fetcher = discovery(action())
  const signal = new AbortController().signal
  expect((await discoverEditor(config, signal)).href).toBe('http://127.0.0.1:9980/browser/pinned/cool.html')
  expect(fetcher).toHaveBeenCalledWith(new URL('http://127.0.0.1:9980/hosting/discovery'), {
    redirect: 'error', signal: expect.any(AbortSignal),
  })
})

it.each([
  ['other origin', action('http://localhost:9980/browser/pinned/cool.html')],
  ['credentials', action('http://user:pass@127.0.0.1:9980/browser/pinned/cool.html')],
  ['other path', action('http://127.0.0.1:9980/anything')],
  ['fragment', action('http://127.0.0.1:9980/browser/pinned/cool.html#other')],
  ['missing action', '<wopi-discovery/>'],
  ['duplicate actions', action().replace('</app>', '<action ext="docx" name="edit"/></app>')],
  ['external entity', '<!DOCTYPE doc [<!ENTITY e SYSTEM "file:///secret">]>' + action()],
  ['malformed XML', '<wopi-discovery>'],
])('refuses discovery with %s', async (_label, xml) => {
  discovery(xml)
  await expect(discoverEditor(config, new AbortController().signal)).rejects.toThrow()
})

it('bounds discovery bytes and rejects a failed server response', async () => {
  const fetcher = discovery(action())
  await expect(discoverEditor({ ...config, maxDiscoveryBytes: 8 }, new AbortController().signal))
    .rejects.toThrow('configured limit')
  fetcher.mockResolvedValue(new Response('Unavailable', { status: 503 }))
  await expect(discoverEditor(config, new AbortController().signal)).rejects.toThrow('unavailable')
})

it('propagates caller cancellation to discovery', async () => {
  const fetcher = discovery(action())
  fetcher.mockImplementation(async (_url, options) => {
    options?.signal?.throwIfAborted()
    return new Response(action())
  })
  const controller = new AbortController()
  controller.abort()
  await expect(discoverEditor(config, controller.signal)).rejects.toThrow()
})

it.each([
  { editorOrigin: 'http://0.0.0.0:9980' },
  { editorOrigin: 'http://127.0.0.1:9980/path' },
  { callbackOrigin: 'http://127.0.0.1:19387' },
  { parentOrigin: '*' },
])('rejects an invalid configured origin %j', override => {
  expect(editorConfigSchema.safeParse({ ...config, ...override }).success).toBe(false)
})
