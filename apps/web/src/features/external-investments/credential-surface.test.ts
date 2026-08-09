import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('external investment browser surface', () => {
  it('contains no Binance or IBKR credential fields or credential mutation routes', () => {
    const sourceFiles = [
      resolve(import.meta.dirname, 'api.ts'),
      resolve(import.meta.dirname, 'types.ts'),
      resolve(import.meta.dirname, '../../routes/_app/integrations.tsx'),
    ]
    const browserSource = sourceFiles.map(file => readFileSync(file, 'utf8')).join('\n')
    const forbiddenFragments = [
      ['flex', 'Token'].join(''),
      ['api', 'Secret'].join(''),
      ['api', 'Key'].join(''),
      ['query', 'Ids'].join(''),
      ['/cred', 'ential'].join(''),
    ]

    for (const fragment of forbiddenFragments) {
      expect(browserSource).not.toContain(fragment)
    }
  })
})
