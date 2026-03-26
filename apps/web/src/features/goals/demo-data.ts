import type { FinancialGoalsResponse } from './types'

export const getDemoFinancialGoals = (): FinancialGoalsResponse => {
  return {
    items: [
      {
        id: 1,
        name: 'Emergency runway',
        goalType: 'emergency_fund',
        currency: 'EUR',
        targetAmount: 12000,
        currentAmount: 8400,
        targetDate: '2026-09-30',
        note: 'Six months of fixed expenses.',
        progressSnapshots: [
          {
            recordedAt: '2026-01-31T18:00:00.000Z',
            amount: 5600,
            note: null,
          },
          {
            recordedAt: '2026-02-28T18:00:00.000Z',
            amount: 7100,
            note: null,
          },
          {
            recordedAt: '2026-03-23T18:00:00.000Z',
            amount: 8400,
            note: null,
          },
        ],
        archivedAt: null,
        createdAt: '2026-01-05T09:00:00.000Z',
        updatedAt: '2026-03-23T18:00:00.000Z',
      },
      {
        id: 2,
        name: 'Tokyo spring trip',
        goalType: 'travel',
        currency: 'EUR',
        targetAmount: 3500,
        currentAmount: 2920,
        targetDate: '2027-04-15',
        note: 'Flights plus 10 nights and food buffer.',
        progressSnapshots: [
          {
            recordedAt: '2026-02-01T08:30:00.000Z',
            amount: 1200,
            note: null,
          },
          {
            recordedAt: '2026-03-01T08:30:00.000Z',
            amount: 2040,
            note: null,
          },
          {
            recordedAt: '2026-03-22T08:30:00.000Z',
            amount: 2920,
            note: null,
          },
        ],
        archivedAt: null,
        createdAt: '2026-01-22T08:30:00.000Z',
        updatedAt: '2026-03-22T08:30:00.000Z',
      },
      {
        id: 3,
        name: 'Apartment down payment',
        goalType: 'home',
        currency: 'EUR',
        targetAmount: 45000,
        currentAmount: 18150,
        targetDate: '2028-12-31',
        note: 'Keep this separate from the emergency fund.',
        progressSnapshots: [
          {
            recordedAt: '2025-12-31T18:15:00.000Z',
            amount: 14000,
            note: null,
          },
          {
            recordedAt: '2026-02-15T18:15:00.000Z',
            amount: 16200,
            note: null,
          },
          {
            recordedAt: '2026-03-24T18:15:00.000Z',
            amount: 18150,
            note: null,
          },
        ],
        archivedAt: null,
        createdAt: '2025-11-20T18:15:00.000Z',
        updatedAt: '2026-03-24T18:15:00.000Z',
      },
      {
        id: 4,
        name: 'Old laptop refresh',
        goalType: 'custom',
        currency: 'EUR',
        targetAmount: 2400,
        currentAmount: 2400,
        targetDate: '2025-10-01',
        note: 'Completed and archived after purchase.',
        progressSnapshots: [
          {
            recordedAt: '2025-07-01T07:00:00.000Z',
            amount: 900,
            note: null,
          },
          {
            recordedAt: '2025-09-15T07:00:00.000Z',
            amount: 2400,
            note: null,
          },
        ],
        archivedAt: '2025-10-03T09:20:00.000Z',
        createdAt: '2025-06-12T07:00:00.000Z',
        updatedAt: '2025-10-03T09:20:00.000Z',
      },
    ],
  }
}
