import { describe, expect, it } from 'bun:test'
import { detectRecurringCommitmentSuggestions } from './detect-recurring-commitments'

describe('detectRecurringCommitmentSuggestions', () => {
  it('detects monthly subscriptions and recurring income candidates', () => {
    const result = detectRecurringCommitmentSuggestions({
      transactions: [
        {
          bookingDate: '2026-01-05',
          amount: -15.99,
          currency: 'EUR',
          label: 'NETFLIX.COM JAN',
        },
        {
          bookingDate: '2026-02-05',
          amount: -16.2,
          currency: 'EUR',
          label: 'NETFLIX.COM FEB',
        },
        {
          bookingDate: '2026-03-05',
          amount: -16,
          currency: 'EUR',
          label: 'NETFLIX.COM MAR',
        },
        {
          bookingDate: '2026-01-28',
          amount: 2100,
          currency: 'EUR',
          label: 'ACME PAYROLL 01',
        },
        {
          bookingDate: '2026-02-28',
          amount: 2090,
          currency: 'EUR',
          label: 'ACME PAYROLL 02',
        },
        {
          bookingDate: '2026-03-28',
          amount: 2115,
          currency: 'EUR',
          label: 'ACME PAYROLL 03',
        },
      ],
      manualValidations: [],
    })

    expect(result).toEqual([
      {
        kind: 'fixed_charge',
        canonicalLabel: 'acme payroll',
        currency: 'EUR',
        estimatedPeriodicity: 'monthly',
        validationStatus: 'suggested',
        occurrenceCount: 3,
        linkedTransactionDates: ['2026-01-28', '2026-02-28', '2026-03-28'],
        lastKnownAmount: 2115,
      },
      {
        kind: 'subscription',
        canonicalLabel: 'netflix com',
        currency: 'EUR',
        estimatedPeriodicity: 'monthly',
        validationStatus: 'suggested',
        occurrenceCount: 3,
        linkedTransactionDates: ['2026-01-05', '2026-02-05', '2026-03-05'],
        lastKnownAmount: 16,
      },
    ])
  })

  it('applies manual validation and excludes rejected candidates', () => {
    const result = detectRecurringCommitmentSuggestions({
      transactions: [
        {
          bookingDate: '2026-01-05',
          amount: -10,
          currency: 'EUR',
          label: 'SPOTIFY 01',
        },
        {
          bookingDate: '2026-02-05',
          amount: -10,
          currency: 'EUR',
          label: 'SPOTIFY 02',
        },
        {
          bookingDate: '2026-03-05',
          amount: -10,
          currency: 'EUR',
          label: 'SPOTIFY 03',
        },
        {
          bookingDate: '2026-01-15',
          amount: 120,
          currency: 'EUR',
          label: 'CAFETERIA ALLOWANCE 1',
        },
        {
          bookingDate: '2026-02-15',
          amount: 120,
          currency: 'EUR',
          label: 'CAFETERIA ALLOWANCE 2',
        },
      ],
      manualValidations: [
        {
          kind: 'subscription',
          canonicalLabel: 'spotify',
          currency: 'EUR',
          validationStatus: 'validated',
        },
        {
          kind: 'fixed_charge',
          canonicalLabel: 'cafeteria allowance',
          currency: 'EUR',
          validationStatus: 'rejected',
        },
      ],
    })

    expect(result).toEqual([
      {
        kind: 'subscription',
        canonicalLabel: 'spotify',
        currency: 'EUR',
        estimatedPeriodicity: 'monthly',
        validationStatus: 'validated',
        occurrenceCount: 3,
        linkedTransactionDates: ['2026-01-05', '2026-02-05', '2026-03-05'],
        lastKnownAmount: 10,
      },
    ])
  })
})
