/** Cordis Loader composition with real Harness services, filesystem and tool dispatch. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it, onTestFinished } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import FsLocal from '@deepseek-ai/dsh-fs-local'
import Llm from '@deepseek-ai/dsh-llm'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjection from '@deepseek-ai/dsh-session-projection'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import * as legal from '../src/index.ts'
import { DocumentStore } from '../src/store.ts'
import { contractFixture } from './fixture.ts'

it('opens and redlines through a loaded tool composition while preserving the source file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'legal-composition-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'contract.docx')
  const original = contractFixture()
  await writeFile(source, original)
  const config = join(root, 'cordis.yml')
  await writeFile(config, [
    '- name: cordis:system-prompt', '- name: cordis:tools', '- name: cordis:fs',
    '- name: cordis:llm', '- name: cordis:sessions', '- name: cordis:projection',
    '- name: cordis:agents', '- name: cordis:agent-loop', '  config:', '    agents: []',
  ].join('\n') + '\n' +
    '- id: legal\n  name: cordis:legal\n  config:\n    storageDirectory: ' + JSON.stringify(join(root, 'documents')) + '\n')
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, 'system-prompt': SystemPrompt,
    tools: ToolRuntime, fs: FsLocal, llm: Llm, sessions: SessionStore, projection: SessionProjection,
    agents: AgentRegistry, 'agent-loop': AgentLoop, legal })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(['contract_open', 'contract_read', 'contract_redline'])
  expect((await ctx.systemPrompt.assemble()).tools.map(schema => schema.name)).toContain('contract_redline')
  const handle = await ctx.agents.create({ sessionId: SessionId('contract-composition'), meta: { cwd: root } })
  onTestFinished(() => handle.dispose())
  const execute = (name: string, args: object) => ctx.tools.execute({ name, arguments: args,
    callId: ToolCallId(name), agent: handle.agent, signal: new AbortController().signal })
  const opened = await execute('contract_open', { path: 'contract.docx' })
  expect(opened.isError).toBe(false)
  const store = new DocumentStore(join(root, 'documents'), { maxFileBytes: 20 * 1024 * 1024,
    maxExpandedBytes: 100 * 1024 * 1024, maxParts: 2000, maxProjectionBytes: 256 * 1024, maxAmendments: 40 }, 'Commercial Agent')
  const first = await store.read(handle.agent.id)
  const redlined = await execute('contract_redline', { expected_hash: first.currentHash,
    amendments: [{ old_text: 'GBP 100000', new_text: 'GBP 200000', comment: 'Proposed cap.' }] })
  expect(redlined.isError).toBe(false)
  expect((await store.read(handle.agent.id)).projection).toContain('200000')
  expect(await readFile(source)).toEqual(original)
  const stale = await execute('contract_redline', { expected_hash: first.currentHash,
    amendments: [{ old_text: 'insurance', new_text: 'coverage' }] })
  expect(stale.isError).toBe(true)
  expect(stale.content).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('changed') })]))
  const row = [...ctx.loader.entries()].find(entry => entry.options.id === 'legal')
  expect(row?.fiber).toBeDefined()
  await row!.fiber!.dispose()
  expect(ctx.tools.schemas()).toEqual([])
  expect('default' in legal).toBe(false)
})
