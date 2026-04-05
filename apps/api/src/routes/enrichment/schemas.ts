import { t } from 'elysia'

export const enrichmentTriageStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('accepted'),
  t.Literal('rejected'),
  t.Literal('needs_review'),
])

export const enrichmentNotesQuerySchema = t.Object({
  itemKeys: t.String({ minLength: 1, maxLength: 2000 }),
})

export const enrichmentNoteUpsertBodySchema = t.Object({
  itemKey: t.String({ minLength: 1, maxLength: 200 }),
  triageStatus: enrichmentTriageStatusSchema,
  note: t.Union([t.String({ maxLength: 1000 }), t.Null()]),
  expectedVersion: t.Optional(t.Numeric({ minimum: 1 })),
})

export const enrichmentBulkTriageBodySchema = t.Object({
  operations: t.Array(
    t.Object({
      itemKey: t.String({ minLength: 1, maxLength: 200 }),
      triageStatus: enrichmentTriageStatusSchema,
      note: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
      expectedVersion: t.Optional(t.Numeric({ minimum: 1 })),
    }),
    { minItems: 1, maxItems: 200 }
  ),
})
