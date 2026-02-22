import { t } from 'elysia'

export const powensConnectionIdSchema = t.Union([t.String(), t.Number()])

export const powensCallbackBodySchema = t.Object({
  connection_id: powensConnectionIdSchema,
  code: t.String({ minLength: 1 }),
})

export const powensSyncBodySchema = t.Optional(
  t.Object({
    connectionId: t.Optional(powensConnectionIdSchema),
  })
)
