import { describe, expect, it } from 'vitest'
import { parseManualSocialItems } from './manual-social-import-dialog'

describe('manual Social import parser', () => {
  it('turns non-empty lines into individual signals', () => {
    expect(parseManualSocialItems('Signal A\n\nSignal B')).toEqual([
      { text: 'Signal A' },
      { text: 'Signal B' },
    ])
  })

  it('accepts structured items and discards entries without text', () => {
    expect(
      parseManualSocialItems(
        '[{"text":"Signal A","author":"Analyste"},{"url":"https://example.test"}]'
      )
    ).toEqual([{ text: 'Signal A', author: 'Analyste' }])
  })
})
