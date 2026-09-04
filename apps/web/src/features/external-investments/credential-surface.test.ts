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

  it('keeps canonical Integrations free of credential labels and secret controls', () => {
    const sourceFiles = [
      resolve(import.meta.dirname, '../../routes/_app/integrations.tsx'),
      resolve(import.meta.dirname, '../integrations-view-model.ts'),
    ]
    const browserSource = sourceFiles
      .map(file => readFileSync(file, 'utf8'))
      .join('\n')
      .toLowerCase()
    const forbiddenLabels = [
      'binance api key',
      'binance api secret',
      'ibkr flex token',
      'ibkr query id',
      'ibkr query ids',
      'credential reveal',
      'secret editing',
      'secret reveal',
      'environment variable',
    ]

    for (const label of forbiddenLabels) {
      expect(browserSource).not.toContain(label)
    }
  })
})
