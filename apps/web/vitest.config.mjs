import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { reactCompilerOptions } from './react-compiler.config.ts'

export default defineConfig({
  // Same native React Compiler as the app build, so component tests run the
  // compiled output (the plugin applies it to client environments such as jsdom).
  plugins: [react({ compiler: reactCompilerOptions('build') })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
})
