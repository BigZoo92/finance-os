import { describe, expect, it } from 'bun:test'
import { EcbFxParseError, parseEcbFxDailyXml } from './fetch-ecb-fx-rates'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time='2026-08-06'>
      <Cube currency='USD' rate='1.0842'/>
      <Cube currency='JPY' rate='168.53'/>
      <Cube currency='GBP' rate='0.8574'/>
      <Cube currency='CHF' rate='0.9312'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`

describe('parseEcbFxDailyXml', () => {
  it('extracts all pairs with the ECB date', () => {
    const rates = parseEcbFxDailyXml(SAMPLE_XML)
    expect(rates).toHaveLength(4)
    const usd = rates.find(rate => rate.quoteCurrency === 'USD')
    expect(usd?.rate).toBe(1.0842)
    expect(usd?.baseCurrency).toBe('EUR')
    expect(usd?.rateTimestamp.toISOString()).toBe('2026-08-06T15:00:00.000Z')
  })

  it('throws a typed error on malformed payloads', () => {
    expect(() => parseEcbFxDailyXml('<xml>nope</xml>')).toThrow(EcbFxParseError)
  })

  it('skips invalid rates instead of importing zeros', () => {
    const xml = SAMPLE_XML.replace("rate='1.0842'", "rate='0'")
    const rates = parseEcbFxDailyXml(xml)
    expect(rates.find(rate => rate.quoteCurrency === 'USD')).toBeUndefined()
    expect(rates).toHaveLength(3)
  })
})
