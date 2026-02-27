import { describe, expect, it } from 'vitest'
import { sanitizePowensConnectionId } from './sanitize-connection-id'

describe('sanitizePowensConnectionId', () => {
  it('removes surrounding quotes and trims spaces', () => {
    expect(sanitizePowensConnectionId('  "7"  ')).toBe('7')
  })

  it('keeps already clean identifiers unchanged', () => {
    expect(sanitizePowensConnectionId('abc-123')).toBe('abc-123')
    expect(sanitizePowensConnectionId(7)).toBe('7')
  })
})
