import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.{test,spec}.ts'],
    },
  },
})