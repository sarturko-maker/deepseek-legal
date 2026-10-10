import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'lib/types/index.js', 'editor/index': 'lib/types/editor/index.js',
    'editor/types': 'lib/types/editor/types.js' },
  platform: 'node',
  format: ['esm'],
  target: 'es2024',
  outDir: 'dist',
  fixedExtension: false,
  deps: { neverBundle: [/^@deepseek-ai\//u] },
  dts: false,
})
