/** Optional Host routes for the local editor; the default tool bundle stays headless-capable. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '../index.ts'
import { z } from 'zod'
import { WopiHost } from './wopi.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    legalEditor: WopiHost
  }
}

/** Optional editor plugin name. */
export const name = 'deepseek-legal-editor'
/** The editor consumes the managed document store and existing Host HTTP provider. */
export const inject = ['legalDocuments', 'webServer']

const configSchema = z.strictObject({
  tokenLifetimeMs: z.number().int().positive().max(2_147_483_647).default(60 * 60 * 1000),
  maxDocuments: z.number().int().positive().default(4),
  maxPendingRequests: z.number().int().positive().default(8),
  userName: z.string().trim().min(1).default('Human Reviewer'),
  parentOrigin: z.literal('dsh-app://app'),
})

/** Mount document-scoped WOPI callbacks without changing ordinary Host authentication.
 * @param ctx Existing document and HTTP services.
 * @param config Editor capability limits and exact native Desktop parent origin.
 */
export function apply(ctx: Context, config: unknown): void {
  const resolved = configSchema.parse(config)
  const host = new WopiHost(ctx.legalDocuments, resolved)
  ctx.effect(() => async () => host.dispose())
  ctx.effect(() => ctx.provide('legalEditor', host))
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/legal/wopi/files',
    handler: (req, res) => host.handle(req, res) }))
}
