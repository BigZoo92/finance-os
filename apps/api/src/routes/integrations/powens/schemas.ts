import { t } from 'elysia'

export const powensConnectionIdSchema = t.Union([t.String(), t.Number()])

export const powensCallbackBodySchema = t.Object({
  connection_id: powensConnectionIdSchema,
  code: t.String({ minLength: 1 }),
  state: t.Optional(t.String()),
})

export const powensSyncBodySchema = t.Optional(
  t.Object({
    connectionId: t.Optional(powensConnectionIdSchema),
    fullResync: t.Optional(t.Boolean()),
  })
)
