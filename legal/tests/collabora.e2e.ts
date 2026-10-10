/** Real CODE load/edit/save checks; each invocation owns its container, ports and storage. */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DOMParser } from '@xmldom/xmldom'
import { strFromU8, unzipSync } from 'fflate'
import { expect, it, onTestFinished } from 'vitest'
import WebSocket from 'ws'
import type { RawData } from 'ws'
import { z } from 'zod'
import { DocumentStore } from '../src/store.ts'
import type { DocumentSnapshot } from '../src/store.ts'
import * as EditorPlugin from '../src/editor/index.ts'
import { contractFixture } from './fixture.ts'

const runFile = promisify(execFile)
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

async function docker(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  try {
    const result = await runFile(process.env.LEGAL_DOCKER_BIN ?? 'docker', args,
      { env, timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true })
    return result.stdout.trim()
  } catch (_error: unknown) {
    // Docker output may include deployment environment; report only the failed operation.
    const operation = args[0] === 'compose' ? args.find(arg => ['up', 'down', 'ps', 'port', 'logs'].includes(arg)) : args[0]
    const project = args[0] === 'compose' ? args[2] : undefined
    throw new Error(`Docker ${operation} failed${project === undefined ? '' : ` for ${project}`}. Check the running Linux engine and pinned image.`)
  }
}

async function ready(origin: string): Promise<void> {
  const deadline = performance.now() + 60000
  while (performance.now() < deadline) {
    try {
      const response = await fetch(`${origin}/hosting/discovery`, { signal: AbortSignal.timeout(2000) })
      if (response.ok) { await response.text(); return }
      await response.body?.cancel()
    } catch (_error: unknown) {
      // A running container may still be initializing its HTTP listener.
    }
    await delay(250)
  }
  throw new Error('CODE did not publish discovery within the startup budget.')
}

async function within<T>(promise: Promise<T>, operation: string): Promise<T> {
  const deadline = Promise.withResolvers<never>()
  const timer = setTimeout(() => deadline.reject(new Error(`CODE did not acknowledge ${operation}.`)), 60000)
  try { return await Promise.race([promise, deadline.promise]) }
  finally { clearTimeout(timer) }
}

function textFrame(data: RawData): string {
  const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data)
  return bytes.toString('utf8').split('\n', 1)[0] ?? ''
}

async function connect(url: string, origin: string) {
  const socket = new WebSocket(url, { origin, maxPayload: 4 * 1024 * 1024, handshakeTimeout: 15000 })
  const closed = Promise.withResolvers<void>()
  const opened = Promise.withResolvers<void>()
  const frames: string[] = []
  const waiters = new Set<{ prefix: string; resolve: (line: string) => void; reject: (error: Error) => void }>()
  let failure: Error | undefined
  const fail = (error: Error) => {
    failure = error
    opened.reject(error)
    for (const waiter of waiters) waiter.reject(error)
    waiters.clear()
  }
  socket.on('open', () => opened.resolve())
  socket.on('unexpected-response', (_request, response) => {
    response.resume()
    fail(new Error(`CODE rejected the WebSocket handshake with HTTP ${response.statusCode}.`))
    socket.terminate()
  })
  socket.on('error', error => fail(new Error(error.message === 'Opening handshake has timed out'
    ? 'The CODE WebSocket handshake timed out.' : 'The CODE editor connection failed.')))
  socket.on('close', () => { closed.resolve(); fail(new Error('The CODE editor connection closed.')) })
  socket.on('message', data => {
    const line = textFrame(data)
    if (line.startsWith('error:')) { fail(new Error('CODE rejected an editor operation.')); return }
    if (!/^(?:status:|loaded:|statechanged: \.uno:ModifiedStatus=|unocommandresult:)/u.test(line)) return
    for (const waiter of waiters) {
      if (line.startsWith(waiter.prefix)) { waiters.delete(waiter); waiter.resolve(line); return }
    }
    if (frames.length >= 32) frames.shift()
    frames.push(line)
  })
  onTestFinished(async () => { socket.terminate(); await closed.promise })
  await opened.promise
  return {
    send: (line: string) => socket.send(line),
    close: async () => { socket.terminate(); await closed.promise },
    wait: async (prefix: string): Promise<string> => {
      if (failure !== undefined) throw failure
      const index = frames.findIndex(line => line.startsWith(prefix))
      if (index >= 0) return frames.splice(index, 1)[0]!
      const result = Promise.withResolvers<string>()
      const waiter = { prefix, resolve: result.resolve, reject: result.reject }
      waiters.add(waiter)
      const timer = setTimeout(() => result.reject(new Error(`CODE did not acknowledge ${prefix.split(':')[0]}.`)), 60000)
      try { return await result.promise }
      finally { clearTimeout(timer); waiters.delete(waiter) }
    },
  }
}

function preserved(snapshot: DocumentSnapshot, image: Uint8Array, humanText: string): void {
  const parts = unzipSync(snapshot.bytes)
  const document = new DOMParser().parseFromString(strFromU8(parts['word/document.xml']!), 'text/xml')
  const values = (tag: string) => Array.from(document.getElementsByTagNameNS(word, tag)).map(node => node.textContent).join(' ')
  expect(values('ins')).toContain('150000')
  expect(values('del')).toContain('100000')
  expect(values('t')).toContain(humanText)
  expect(document.getElementsByTagNameNS(word, 'b').length).toBeGreaterThan(0)
  expect(document.getElementsByTagNameNS(word, 'drawing').length).toBeGreaterThan(0)
  const comments = new DOMParser().parseFromString(strFromU8(parts['word/comments.xml']!), 'text/xml')
  expect(comments.documentElement?.textContent).toContain('Keep this human comment.')
  expect(comments.documentElement?.textContent).toContain('Review the increased liability cap.')
  expect(Object.entries(parts).filter(([name]) => /^word\/header\d+\.xml$/u.test(name))
    .map(([, bytes]) => strFromU8(bytes)).join(' ')).toContain('Synthetic contract header')
  const media = Object.entries(parts).filter(([name]) => name.startsWith('word/media/'))
  expect(media.some(([, bytes]) => Buffer.from(bytes).equals(Buffer.from(image))),
    `Original image bytes: ${image.length}; saved media: ${media.map(([name, bytes]) => `${name} (${bytes.length} bytes)`).join(', ')}`).toBe(true)
}

it.skipIf(process.env.LEGAL_EDITOR_E2E !== '1')('preserves ADEU revisions through two real CODE edits and WOPI saves', async () => {
  expect(await docker(['info', '--format', '{{.OSType}}'])).toBe('linux')
  const root = await mkdtemp(join(tmpdir(), 'legal-code-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const limits = { maxFileBytes: 1024 * 1024, maxExpandedBytes: 4 * 1024 * 1024,
    maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10 }
  const store = new DocumentStore(root, limits, 'Commercial Agent')
  const session = SessionId('code-roundtrip')
  const original = contractFixture(undefined, true)
  const image = unzipSync(original)['word/media/image1.png']!
  const signal = new AbortController().signal
  const first = await store.start(session, 'synthetic.docx', original, signal)
  await store.amend(session, first.currentHash, [{ old_text: 'GBP 100000', new_text: 'GBP 150000',
    comment: 'Review the increased liability cap.' }], signal)
  ctx.provide('legalDocuments', store)
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await ctx.plugin(EditorPlugin, { parentOrigin: 'dsh-app://app', editorOrigin: 'http://127.0.0.1:9980',
    callbackOrigin: 'http://host.docker.internal:19387' })
  const compose = fileURLToPath(new URL('../editor/compose.yml', import.meta.url))
  const project = `legal-code-test-${randomBytes(8).toString('hex')}`
  const env = { ...process.env, LEGAL_HOST_PORT: String(ctx.webServer.port), LEGAL_EDITOR_PORT: '0' }
  const args = ['compose', '-p', project, '-f', compose]
  onTestFinished(async () => {
    await docker([...args, 'down', '--timeout', '10'], env)
    expect(await docker([...args, 'ps', '-a', '-q'], env)).toBe('')
  })
  await docker([...args, 'up', '-d', '--pull', 'never'], env)
  const published = await docker([...args, 'port', 'code', '9980'], env)
  const port = z.coerce.number().int().min(1).max(65535).parse(published.split(':').at(-1))
  const origin = `http://127.0.0.1:${port}`
  await ready(origin)
  const capabilities = await fetch(`${origin}/hosting/capabilities`, { signal: AbortSignal.timeout(10000) })
  expect(capabilities.ok).toBe(true)
  expect(z.object({ productVersion: z.string() }).parse(await capabilities.json()).productVersion).toBe('26.04.1.4')
  const callbacks: string[] = []
  for (const round of [1, 2]) {
    const grant = await ctx.legalEditor.open(session)
    const path = `/legal/wopi/files/${grant.fileId}`
    const wopi = `http://host.docker.internal:${ctx.webServer.port}${path}`
    const saved = Promise.withResolvers<number>()
    for (const contents of [false, true]) {
      ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: path + (contents ? '/contents' : ''),
        handler: async (req, res) => {
          const override = req.headers['x-wopi-override']
          const operation = typeof override === 'string' ? override : `${req.method} ${contents ? 'contents' : 'metadata'}`
          await ctx.legalEditor.handle(req, res)
          callbacks.push(`${operation} ${res.statusCode}`)
          if (operation === 'PUT') saved.resolve(res.statusCode)
        } }))
    }
    const documentUrl = `${wopi}?access_token=${grant.accessToken}`
    let socket: Awaited<ReturnType<typeof connect>>
    try {
      socket = await connect(`${origin.replace('http:', 'ws:')}/cool/${encodeURIComponent(documentUrl)}/ws?WOPISrc=${encodeURIComponent(wopi)}`, origin)
    } catch (error: unknown) {
      const logs = await docker([...args, 'logs', '--no-color', 'code'], env)
      const diagnoses = ['Connection refused', 'Connection timed out', 'No acceptable WOPI hosts', 'Unauthorized']
        .filter(message => logs.toLowerCase().includes(message.toLowerCase()))
      throw new Error(`${error instanceof Error ? error.message : 'CODE connection failed.'} WOPI callbacks: ${callbacks.join(', ') || 'none'}. Container signals: ${diagnoses.join(', ') || 'none'}.`)
    }
    socket.send('coolclient 0.1')
    socket.send(`load url=${encodeURIComponent(wopi)} lang=en-US deviceFormFactor=desktop`)
    await socket.wait('status:')
    const changed = socket.wait('statechanged: .uno:ModifiedStatus=true')
    const humanText = `Human edit ${round} via CODE. `
    socket.send(`paste mimetype=text/plain;charset=utf-8\n${humanText}`)
    await changed
    socket.send('save dontTerminateEdit=1 dontSaveIfUnmodified=0')
    expect(await within(saved.promise, 'save')).toBe(200)
    await socket.close()
    await ctx.legalEditor.close(grant.fileId)
    const snapshot = await store.withEditor(session, signal, editor => editor.read())
    preserved(snapshot, image, humanText.trim())
    expect(snapshot.view.originalHash).toBe(first.originalHash)
    const directories = await readdir(root)
    expect(await readFile(join(root, directories[0]!, `${first.originalHash}.docx`))).toEqual(original)
    if (round === 1) {
      await store.amend(session, snapshot.view.currentHash,
        [{ old_text: 'insurance', new_text: 'coverage' }], signal)
    } else {
      expect(snapshot.view.projection).toContain('coverage')
      expect(snapshot.view.projection).toContain('Human edit 1 via CODE.')
    }
  }
  expect(callbacks.filter(operation => operation === 'GET metadata 200').length).toBeGreaterThanOrEqual(2)
  expect(callbacks.filter(operation => operation === 'GET contents 200').length).toBeGreaterThanOrEqual(2)
  expect(callbacks.filter(operation => operation === 'LOCK 200').length).toBeGreaterThanOrEqual(2)
  expect(callbacks.filter(operation => operation === 'PUT 200').length).toBeGreaterThanOrEqual(2)
})
