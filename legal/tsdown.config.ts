import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/editor/index.ts'],
  platform: 'node',
  format: ['esm'],
  target: 'es2024',
  outDir: 'dist',
  fixedExtension: false,
  deps: { neverBundle: [/^@deepseek-ai\//u] },
  dts: false,
})
