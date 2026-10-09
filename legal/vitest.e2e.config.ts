/** Docker-backed editor checks run separately from the keyless unit suite. */
import { defineConfig } from 'vitest/config'
import unit from './vitest.config.ts'

export default defineConfig({
  ...unit,
  test: { ...unit.test, include: ['tests/**/*.e2e.ts'], testTimeout: 180000, hookTimeout: 120000 },
})
