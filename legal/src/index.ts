/** Optional tracked-contract tools over the normal Harness tool and filesystem providers. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { isAbsolute } from 'node:path'
import { z } from 'zod'
import { amendmentSchema, documentHashSchema } from './document.ts'
import { DocumentStore } from './store.ts'
import { openDocument } from './open.ts'
import * as editor from './editor/index.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    legalDocuments: DocumentStore
  }
}

/** Cordis entry name. */
export const name = 'deepseek-legal-redlining'
/** Standard services; no agent-loop replacement or independent application launcher. */
export const inject = ['tools', 'fs']

const configSchema = z.strictObject({
  storageDirectory: z.string().refine(isAbsolute, 'storageDirectory must be an absolute path.'),
  author: z.string().trim().min(1).default('Commercial Agent'),
  maxFileBytes: z.number().int().positive().default(20 * 1024 * 1024),
  maxExpandedBytes: z.number().int().positive().default(100 * 1024 * 1024),
  maxParts: z.number().int().positive().default(2000),
  maxProjectionBytes: z.number().int().positive().default(256 * 1024),
  maxAmendments: z.number().int().positive().default(40),
  editor: editor.editorConfigSchema.optional(),
})

function sessionId(exec: ToolExecution): SessionId {
  if (exec.agent === undefined) throw new Error('Contract tools require a live Harness Session.')
  return exec.agent.id
}

const output = {
  schema: { type: 'string' as const },
  render: (_args: object, value: string) => [{ type: 'text' as const, text: value }],
}

/** Register reversible contract tools with application-owned document storage.
 * @param ctx Harness plugin context with its normal filesystem and tool pipeline.
 * @param config Deployment limits and an explicit application-owned storage directory.
 */
export function apply(ctx: Context, config: unknown): void {
  const resolved = configSchema.parse(config)
  const store = new DocumentStore(resolved.storageDirectory, resolved, resolved.author)
  ctx.effect(() => ctx.provide('legalDocuments', store))
  if (resolved.editor !== undefined) ctx.plugin(editor, resolved.editor)
  const lifetime = new AbortController()
  const pending = new Set<Promise<string>>()
  const run = (signal: AbortSignal, operation: (signal: AbortSignal) => Promise<string>): Promise<string> => {
    const work = operation(AbortSignal.any([signal, lifetime.signal]))
    pending.add(work)
    void work.finally(() => pending.delete(work)).catch((_error: unknown) => {
      // The returned work promise carries the tool failure; cleanup must not duplicate it.
    })
    return work
  }
  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled([...pending])
  })
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'contract_open',
    description: 'Open one DOCX contract in this Session. Preserve its original and create a continuing working copy. Returns current text, tracked revisions and comments. Save and close an open editor before asking for amendments.',
    parameters: { path: { type: 'string', required: true, description: 'The DOCX source path. Ask the user which contract and reviewing party to use when unspecified.' } },
    output,
    execute(args, exec) { return run(exec.signal, async signal => {
      const id = sessionId(exec)
      const cwd = exec.agent?.session.header.cwd
      if (cwd === undefined) throw new Error('Select a workspace before opening a contract.')
      return JSON.stringify(await openDocument(ctx, store, id, cwd, args.path, signal))
    }) },
    presentCall: () => ({ card: 'generic', title: 'Open contract' }),
  })))
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'contract_read',
    description: 'Read the continuing contract, current hash, tracked amendments and comments. Read before each amendment batch. This does not accept or reject revisions.',
    parameters: {},
    output,
    execute(_args, exec) { return run(exec.signal, async signal => {
      signal.throwIfAborted()
      return JSON.stringify(await store.read(sessionId(exec)))
    }) },
    presentCall: () => ({ card: 'generic', title: 'Read contract' }),
  })))
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'contract_redline',
    description: 'Apply a complete batch of literal replacements as native Word tracked changes. Use the latest currentHash from contract_read. The original is preserved. Ambiguous targets, failed edits and stale hashes reject the whole batch. Never use filesystem or shell tools to rewrite the managed contract.',
    parameters: {
      expected_hash: { type: 'string', required: true, description: 'Exact currentHash from the latest contract_read or contract_open result.' },
      amendments: { type: 'array', required: true, description: 'Ordered literal replacements; each target must be unique in the current document.',
        items: { type: 'object', additionalProperties: false, properties: {
          old_text: { type: 'string', required: true }, new_text: { type: 'string', required: true },
          comment: { type: 'string', description: 'Optional reason attached as a Word comment.' },
        } } },
    },
    output,
    execute(args, exec) { return run(exec.signal, async signal => {
      const amendments = z.array(amendmentSchema).min(1).max(resolved.maxAmendments).parse(args.amendments)
      return JSON.stringify(await store.amend(sessionId(exec), documentHashSchema.parse(args.expected_hash), amendments, signal))
    }) },
    presentCall: () => ({ card: 'generic', title: 'Redline contract' }),
  })))
}
