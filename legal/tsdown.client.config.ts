import { resolve } from 'node:path'
import { clientBundle } from '../packages/client/tsdown.client.ts'

export default clientBundle('@deepseek-legal/redlining', [], {
  hostPhase: true, manifest: resolve(import.meta.dirname, 'package.json'),
})
